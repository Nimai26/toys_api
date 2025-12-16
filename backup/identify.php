<?php
// API minimal d'identification d'objet par code (ISBN/EAN/UPC) ou recherche texte
// Renvoie JSON: { success, type, identifier: {type, value}, provider_data, confidence, source }

header('Content-Type: application/json; charset=utf-8');
// touch: no-op comment to refresh editor language server diagnostics

require_once __DIR__ . '/../../../config/db.php'; // pour l'accès à $pdo si nécessaire
require_once __DIR__ . '/../../../config/i18n.php';
require_once __DIR__ . '/../logger.php';
$baseCacheDir = __DIR__ . '/../../../cache/identify';
// Session potentiellement synchronisée ci-dessus via get_current_user_data().
$input = $_GET;
api_log('identify','DEBUG','Received identify request', ['input'=>$input]);
$mode_search = isset($input['mode_search']) ? trim(strtolower((string)$input['mode_search'])) : null;
$main_identify = 'code';
if ($mode_search)
{
    api_log('identify','DEBUG','Mode recherche texte activé');
    // mode recherche texte
    // (non implémenté dans ce snippet)
}else
{
    api_log('identify','DEBUG','Mode identification par code activé');
    // mode identification par code
    // (non implémenté dans ce snippet)
}

$open_library_timeout = 10;
$google_books_timeout = 10;

$user_id = $_GET['user_id'] ?? null;
api_log('identify','DEBUG','Vérification du statut premium de l\'utilisateur',['session_userid' => $user_id ]);

$isPremium = $_GET['is_premium'] ?? null;

api_log('identify','INFO','Premium check', ['detected_is_premium' => $isPremium, 'session_name'=>session_name(), 'session_id'=>session_id(), 'session_cookie'=> $cookiePresent, 'cookie_jar'=>$_COOKIE]);

$type = $input['type'] ?? 'all';

// `provider` peut être un string ou un tableau de strings
$provider = $input['provider'] ?? 'google_books';

// Normaliser les fournisseurs demandés en tableau
$providers = [];
if (isset($input['provider'])) {
    if (is_array($input['provider'])) {
        $providers = $input['provider'];
    } else {
        // essayer de décoder JSON (au cas où c'est un tableau encodé en string)
        $decoded = json_decode($input['provider'], true);
        if (is_array($decoded)) {
            $providers = $decoded;
        } else {
            $providers = [ (string)$input['provider'] ];
        }
    }
}
// Normaliser : trim et enlever les entrées vides
$providers = array_values(array_filter(array_map('trim', $providers)));
api_log('identify','DEBUG','Providers after normalization', ['providers'=>$providers]);

// langue préférée pour les recherches (Google Books, etc.)
$lang = trim(strtolower($input['lang'] ?? '')) ?: 'en';


// Logique d'identification
$code = $_GET['code'] ?? null;
$q = $_GET['q'] ?? null;


if (!$code && !$q) {
    api_log('identify','WARN','Code ou paramètre q manquant');
    json_response(['success'=>false,'message'=>'missing code or q']);
}
// Charger les informations complètes des providers depuis la table Admin_webApi
$lst_provider_info = []; // accès par nom : $lst_provider_info['provider_name'] => ['col'=>val, ...]
$lst_no_code = [];       // liste des providers dont READ_CODE == 0

if (isset($pdo)) {
    try {
        $stmt = $pdo->prepare('SELECT * FROM `Admin_webApi`');
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        if (is_array($rows)) {
            foreach ($rows as $r) {
                $name = isset($r['name']) ? trim($r['name']) : null;
                if ($name === null || $name === '') continue;
                // normaliser certaines colonnes en types simples
                if (isset($r['READ_CODE'])) $r['READ_CODE'] = intval($r['READ_CODE']);
                if (isset($r['USER_API'])) $r['USER_API'] = intval($r['USER_API']);
                if (isset($r['id'])) $r['id'] = intval($r['id']);
                $lst_provider_info[$name] = $r;
                if (isset($r['READ_CODE']) && intval($r['READ_CODE']) === 0) {
                    $lst_no_code[] = $name;
                }
            }
            // dédupliquer et réindexer la liste
            $lst_no_code = array_values(array_unique($lst_no_code));
        }
    } catch (Exception $e) {
        $lst_provider_info = [];
        $lst_no_code = [];
    }
}
// Helper: retrouve la clé API pour un nom de fournisseur. Préfère la config DB ($cfgMap), fallback vers getenv().
function api_key_for($name) {
    global $cfgMap, $pdo;
    $n = trim(strtolower((string)$name));
    if ($n === '') return null;

    $user_id = $_GET['user_id'] ?? null;

    // Recherche en base : si le provider est configuré pour utiliser des clés par utilisateur (USER_API=1),
    // lire la clé de l'utilisateur dans `users_api` (si présente et non vide).
    if (isset($pdo)) {
        try {
            $stmt = $pdo->prepare('SELECT `id`, `api_key`, `USER_API` FROM `Admin_webApi` WHERE LOWER(`name`) = :name LIMIT 1');
            $stmt->execute([':name' => $n]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (Exception $e) {
            $row = null;
        }

        if (!empty($row)) {
                // Si le provider supporte des clés API par utilisateur, tenter de la charger
                if (!empty($row['USER_API'])) {
                    if ($user_id) {
                        try {
                            $s2 = $pdo->prepare('SELECT `api_key` FROM `users_api` WHERE `user_id` = :uid AND `webapi_id` = :wid LIMIT 1');
                            $s2->execute([':uid' => $user_id, ':wid' => $row['id']]);
                            $urow = $s2->fetch(PDO::FETCH_ASSOC);
                            if (!empty($urow['api_key'])) {
                                api_log('identify','INFO','Using user-specific API key', ['provider'=>$n,'user_id'=>$user_id]);
                                return $urow['api_key'];
                            }
                        } catch (Exception $e) {
                            // ignorer et continuer
                        }
                    }
                    // IMPORTANT : le provider exige une clé utilisateur ; NE PAS retomber sur Admin_webApi.api_key, cfgMap ou getenv
                    // Retourner NULL explicite pour indiquer qu'aucune clé n'est disponible pour cet utilisateur/provider
                    api_log('identify','WARN','Le provider requiert une clé utilisateur mais aucune n\'est configurée pour cet utilisateur', ['provider'=>$n,'user_id'=>$user_id]);
                    return null;
                } else {
                    // Si le provider n'exige pas de clé par utilisateur, préférer `Admin_webApi.api_key` si présente
                    if (!empty($row['api_key'])) {
                        return $row['api_key'];
                    }
                }
            }
    }

    // Retour vers la configuration en mémoire si présente (ancien comportement)
    if (isset($cfgMap[$n]) && !empty($cfgMap[$n]['api_key'])) {
        return $cfgMap[$n]['api_key'];
    }

    return null;
}

function json_response($data) {
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// Fonctions utilitaires
function normalize_code($code) {
    $c = preg_replace('/[^0-9Xx]/', '', $code);
    // ISBN10 -> ISBN13 conversion omitted for brevity; return numeric-like
    return $c;
}

// Détecte si une chaîne fournie est plus probablement un texte à rechercher
// (titre, nom, description) plutôt qu'un code numérique (ISBN/UPC/EAN).
function is_text_search_candidate($s) {
    if (!is_string($s)) return false;
    $s = trim($s);
    if ($s === '') return false;

    // Si contient au moins une lettre (latin étendu) -> texte
    if (preg_match('/[\p{L}]/u', $s)) return true;

    // Si contient des espaces (plusieurs mots) et n'est pas strictement numérique -> texte
    if (preg_match('/\s+/', $s) && preg_match('/\D/', $s)) return true;

    // Alphanum mixte (ex: "PS4 Slim") -> texte
    if (preg_match('/[A-Za-z].*\d|\d.*[A-Za-z]/u', $s)) return true;

    // Si longueur raisonnable (>4) mais pas un code-barres commun (8-13 chiffres), considérer texte
    $digitsOnly = preg_replace('/\D/', '', $s);
    $len = strlen($s);
    $digitLen = strlen($digitsOnly);
    if ($len > 4 && !($digitLen >= 8 && $digitLen <= 13 && $digitLen === $len)) return true;

    return false;
}

// Conversion ISBN10 -> ISBN13
function isbn10_to_isbn13($isbn10) {
    $s = preg_replace('/[^0-9Xx]/', '', $isbn10);
    if (!preg_match('/^\d{9}[\dXx]$/', $s)) return null;
    $core = '978' . substr($s,0,9);
    // calcul checksum
    $sum = 0;
    for ($i=0;$i<12;$i++) {
        $digit = intval($core[$i]);
        $sum += ($i % 2 === 0) ? $digit : $digit * 3;
    }
    $mod = $sum % 10;
    $check = ($mod === 0) ? 0 : (10 - $mod);
    return $core . strval($check);
}

// Validation ISBN10 ou ISBN13

function isbn_valid($s) {
    $s = preg_replace('/[^0-9Xx]/','',$s);
    if (preg_match('/^\d{13}$/', $s)) {
        $sum = 0;
        for ($i=0;$i<13;$i++) {
            $d = intval($s[$i]);
            $sum += ($i % 2 === 0) ? $d : $d * 3;
        }
        return $sum % 10 === 0;
    }
    if (preg_match('/^\d{9}[\dXx]$/', $s)) {
        $sum = 0;
        for ($i=0;$i<9;$i++) $sum += ($i+1) * intval($s[$i]);
        $check = $sum % 11;
        $last = strtoupper($s[9]);
        if ($check === 10) return $last === 'X';
        return intval($last) === $check;
    }
    return false;
}

function cache_get($key) {
    global $baseCacheDir;
    $fn = $baseCacheDir . '/' . preg_replace('/[^a-zA-Z0-9_\-\.]/', '_', $key) . '.json';
    if (is_file($fn)) {
        $raw = @file_get_contents($fn);
        if ($raw !== false) {
            $data = json_decode($raw, true);
            if ($data) return $data;
        }
    }
    return null;
}

function cache_set($key, $data) {
    global $baseCacheDir;
    $fn = $baseCacheDir . '/' . preg_replace('/[^a-zA-Z0-9_\-\.]/', '_', $key) . '.json';
    @file_put_contents($fn, json_encode($data, JSON_UNESCAPED_UNICODE));
}

// Fonction utilitaire cURL pour obtenir et décoder JSON
function curl_get_json($url, $timeout = 20) {
    //$timeout = 30; //bypass le timeout
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_USERAGENT, 'SnowShelf/1.0 (+https://snowshelf)');
    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    if ($resp === false) return null;
    $j = json_decode($resp, true);
    if ($j === null) return null;
    return $j;
}
// utilitaire cURL pour récupérer le contenu d'une URL
function curl_get($url, &$httpCode = null, $timeout = 10) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_MAXREDIRS, 5);
    curl_setopt($ch, CURLOPT_USERAGENT, 'SnowShelf-Parser/1.0 (+https://example.local)');
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
    curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);
    // éviter d'envoyer des cookies/sessions du serveur
    curl_setopt($ch, CURLOPT_COOKIEFILE, '');
    $body = curl_exec($ch);
    if ($body === false) {
        $errno = curl_errno($ch);
        $err = curl_error($ch);
        curl_close($ch);
        return ['ok' => false, 'error' => "curl_error($errno): $err"];
    }
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['ok' => true, 'body' => $body];
}


//-----------------------------------------------------------------------------------------------------------
//PARTIE RECHERCHE CODE
//-----------------------------------------------------------------------------------------------------------


// Interroger UPCItemDB (trial endpoint) pour UPC/EAN
function query_upcitemdb($upc) {
    $apiKey = api_key_for('upcitemdb');
    // trial endpoint does not require key, but use if present
    $url = 'https://api.upcitemdb.com/prod/trial/lookup?upc=' . urlencode($upc);
    if ($apiKey) $url .= '&apikey=' . urlencode($apiKey);
    $json = curl_get_json($url, 8);
    if (empty($json) || empty($json['code'])) return null;
    $item = $json['items'][0] ?? null;
    if (!$item) return null;
    return [
        'title' => $item['title'] ?? null,
        'brand' => $item['brand'] ?? null,
        'model' => $item['model'] ?? null,
        'images' => $item['images'] ?? [],
        'raw' => $item
    ];
}


// Interroger UPCData 100 rq max par jour
function query_upcdatabase($upc) {
    $apiKey = api_key_for('upcdatabase');
    // Le provider UPCDatabase nécessite maintenant une clé API pour être utilisé
    // via notre flux. Si aucune clé n'est disponible (par utilisateur ou admin),
    // retourner NULL explicitement.
    if (empty($apiKey)) {
        api_log('identify','WARN','upcdatabase nécessite une clé API non fournie', ['upc'=>$upc]);
        return null;
    }

    // Construire l'URL avec la clé requise
    // https://api.upcdatabase.org/product/0111222333446?apikey=THISISALIVEDEMOAPIKEY19651D54X47
    $url = 'https://api.upcdatabase.org/product/' . urlencode($upc) . '?apikey=' . urlencode($apiKey);
    $json = curl_get_json($url, 8);
    if (empty($json) || empty($json['code'])) return null;
    $item = $json['items'][0] ?? null;
    if (!$item) return null;
    return [
        'title' => $item['title'] ?? null,
        'brand' => $item['brand'] ?? null,
        'model' => $item['model'] ?? null,
        'images' => $item['images'] ?? [],
        'raw' => $item
    ];
}

// Interroger EAN-DB (requiert un JWT dans le champ api_key de l'utilisateur)
function query_eandb($ean) {
    $apiKey = api_key_for('eandb');
    // Si pas de clé, ne pas tenter la requête
    if (empty($apiKey)) {
        api_log('identify','WARN','eandb nécessite une clé API (JWT) non fournie', ['ean'=>$ean]);
        return null;
    }

    $url = 'https://ean-db.com/api/v2/product/' . urlencode($ean);

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_USERAGENT, 'SnowShelf/1.0 (+https://snowshelf)');
    // Inclure le JWT dans l'en-tête Authorization: Bearer <token>
    $headers = [
        'Authorization: Bearer ' . $apiKey,
        'Accept: application/json'
    ];
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);

    if ($resp === false || $resp === null) return null;
    $j = json_decode($resp, true);
    if ($j === null) return null;

    // Si l'API renvoie une erreur structurée, propager l'information afin
    // que l'interface puisse informer l'utilisateur (ex: quota épuisé).
    if (!empty($j['error']) && is_array($j['error'])) {
        $err = $j['error'];
        $ecode = isset($err['code']) ? intval($err['code']) : null;
        $edesc = $err['description'] ?? ($err['message'] ?? null);
        api_log('identify','WARN','eandb API error', ['ean'=>$ean,'code'=>$ecode,'description'=>$edesc]);
        // Si le code est 403, marquer explicitement que le quota est dépassé
        if ($ecode === 403) {
            return ['error' => ['code' => $ecode, 'description' => $edesc], 'quota_exceeded' => true, 'raw' => $j];
        }
        return ['error' => ['code' => $ecode, 'description' => $edesc], 'raw' => $j];
    }

    // Attendu: { product: { barcode, titles, manufacturer, images, provider_data, ... } }
    $prod = $j['product'] ?? null;
    if (!$prod) return null;

    // Choisir un titre: préférence pour l'anglais, sinon première langue disponible
    $title = null;
    if (!empty($prod['titles']) && is_array($prod['titles'])) {
        if (!empty($prod['titles']['en'])) $title = $prod['titles']['en'];
        else {
            $first = reset($prod['titles']);
            if ($first) $title = $first;
        }
    }

    // Manufacturer
    $manufacturer = null;
    if (!empty($prod['manufacturer']) && is_array($prod['manufacturer'])) {
        if (!empty($prod['manufacturer']['titles']['en'])) $manufacturer = $prod['manufacturer']['titles']['en'];
        else {
            $mfirst = $prod['manufacturer']['titles'] ?? null;
            if (is_array($mfirst)) $manufacturer = reset($mfirst);
        }
    }

    // Images
    $images = [];
    if (!empty($prod['images']) && is_array($prod['images'])) {
        foreach ($prod['images'] as $im) {
            if (!empty($im['url'])) $images[] = $im['url'];
        }
    }

    return [
        'title' => $title,
        'manufacturer' => $manufacturer,
        'images' => $images,
        'raw' => $prod
    ];
}

// Interroger Google Books par ISBN
function query_google_books_by_isbn($q, $lang = null) {
    $apiKey = api_key_for('google_books');
    global $google_books_timeout;
    if (!$lang) {
        $lang = getenv('GOOGLE_BOOKS_LANG') ?: null;
    }

    $do_query = function($q) use ($apiKey,$lang, $google_books_timeout) {
        $url = 'https://www.googleapis.com/books/v1/volumes?q=isbn:' . urlencode($q);
        if ($apiKey) $url .= '&key=' . urlencode($apiKey);
        if ($lang) $url .= '&langRestrict=' . urlencode($lang);
        api_log('identify','DEBUG','Querying Google Books code', ['url'=>$url]);
        $json = curl_get_json($url, $google_books_timeout);
        if (empty($json['items'])) return null;
        $v = $json['items'][0]['volumeInfo'] ?? null;
        if (!$v) return null;
        return [
            'title' => $v['title'] ?? null,
            'authors' => $v['authors'] ?? [],
            'publish_date' => $v['publishedDate'] ?? null,
            'cover' => $v['imageLinks']['thumbnail'] ?? null,
            'raw' => $v
        ];
    };
    return $do_query($q, null);
}

// Interroger OpenLibrary par ISBN
function query_openlibrary_by_isbn($isbn,$lang) {
    $url = 'https://openlibrary.org/api/books?bibkeys=ISBN:' . urlencode($isbn) . '&format=json&jscmd=data&lang:'.$lang;
    api_log('identify','DEBUG','Querying OpenLibrary by ISBN', ['url'=>$url]);
    global $open_library_timeout;
    $json = curl_get_json($url, $open_library_timeout);
    if (!$json) return null;
    $key = 'ISBN:' . $isbn;
    if (!isset($json[$key])) return null;
    $d = $json[$key];
    return [
        'title' => $d['title'] ?? null,
        'authors' => array_map(function($a){return $a['name'] ?? null;}, $d['authors'] ?? []),
        'publish_date' => $d['publish_date'] ?? null,
        'cover' => $d['cover']['large'] ?? $d['cover']['medium'] ?? $d['cover']['small'] ?? null,
        'raw' => $d
    ];
}




// Exécute les requêtes de recherche aux providers demandés
function run_search_query_code($code, $isbn = false, $upc = false) {
    // Collecte tous les résultats des providers demandés et les retourne
    global $providers, $lang, $lst_no_code,$lst_provider_info;
    api_log('identify','DEBUG','isPremium value in run_search_query_code', ['is_premium'=>$isPremium]);
    $found = [];
    if (!is_array($providers)) $providers = [];
    api_log('identify','DEBUG','Providers to query', ['providers'=>$providers,'code'=>$code,'isbn'=>$isbn,'upc'=>$upc]);
    foreach ($providers as $prov) {
        $prov = strtolower(trim((string)$prov));
        if ($prov === 'google_books' && $isbn) { // ne tenter Google Books que si code est un ISBN valide
            $rs = query_google_books_by_isbn($code, $lang);
            api_log('identify','DEBUG','Google Books response', ['response'=>$rs]);
            if ($rs) {
                $found[] = [
                    'type' => $lst_provider_info[$prov]['Type'],
                    'identifier' => $prov,
                    'provider_data' => [$rs],
                    'confidence' => 0.8,
                    'source' => $prov
                ];
            }
        } elseif ($prov === 'openlibrary' && $isbn) { // ne tenter OpenLibrary que si code est un ISBN valide
            $rs = query_openlibrary_by_isbn($code, $lang);
            api_log('identify','DEBUG','OpenLibrary response', ['response'=>$rs]);
            if ($rs) {
                $found[] = [
                    'type' => $lst_provider_info[$prov]['Type'],
                    'identifier' => $prov,
                    'provider_data' => [$rs],
                    'confidence' => 0.8,
                    'source' => $prov
                ];
            }
        } 
        elseif ($prov === 'eandb' && $upc) { // tenter EAN-DB que si code est un UPC/EAN valide
            $rs = query_eandb($code);
            if ($rs) {
                $found[] = [
                    'type' => $lst_provider_info[$prov]['Type'],
                    'identifier' => $prov,
                    'provider_data' => [$rs],
                    'confidence' => 0.8,
                    'source' => $prov
                ];
            }
        }
        elseif ($prov === 'upcdatabase' && $upc) { // ne tenter UPCDatabase que si code est un UPC/EAN valide
            $rs = query_upcdatabase($code);
            if ($rs) {
                $found[] = [
                    'type' => $lst_provider_info[$prov]['Type'],
                    'identifier' => $prov,
                    'provider_data' => [$rs],
                    'confidence' => 0.8,
                    'source' => $prov
                ];
            }
        }
        elseif ($prov === 'upcitemdb' && $upc) { // ne tenter UPCItemDB que si code est un UPC/EAN valide
            $rs = query_upcitemdb($code);
            if ($rs) {
                $found[] = [
                    'type' => $lst_provider_info[$prov]['Type'],
                    'identifier' => $prov,
                    'provider_data' => [$rs],
                    'confidence' => 0.8,
                    'source' => $prov
                ];
            }
        }elseif( in_array($prov, $lst_no_code) ){
            $rs = [
            'title' => 'Lecture de code non supportée par ce fournisseur : ' . $prov,
            'manufacturer' => 'none',
            'images' => '',
            'raw' => ''
            ];
            $found[] = [
                'type' => $lst_provider_info[$prov]['Type'],
                'identifier' => $prov,
                'provider_data' => [$rs],
                'confidence' => 0.7,
                'source' => $prov
            ];    
            // provider reconnu mais ne supportant pas les codes
            api_log('identify','INFO','Fournisseur ne supportant pas les codes, ignoré', ['provider'=>$prov]);

        }
        else{
            // provider inconnu
            api_log('identify','WARN','Fournisseur inconnu ou non pris en charge', ['provider'=>$prov]);
            json_response(['success'=>false,'message'=>'Type de fournisseur inconnu ou non pris en charge']);
        }        
    }
    return count($found) ? $found : null;
}

//-----------------------------------------------------------------------------------------------------------
//FIN PARTIE RECHERCHE CODE
//-----------------------------------------------------------------------------------------------------------


//-----------------------------------------------------------------------------------------------------------
//PARTIE RECHERCHE TEXTE
//-----------------------------------------------------------------------------------------------------------
// Interroger Google Books par texte
function query_google_books_txt($q, $lang = null, $maxResults) {
    global $main_identify;
    $main_identify='text';
    $apiKey = api_key_for('google_books');
    global $google_books_timeout;
    api_log('identify','DEBUG','Google Books text query', ['query'=>$q,'maxResults'=>$maxResults,'lang'=>$lang]);
    if (!$lang) {
        $lang = getenv('GOOGLE_BOOKS_LANG') ?: null;
    }

    $do_query = function($q) use ($apiKey, $maxResults, $lang, $google_books_timeout) {
        $url = 'https://www.googleapis.com/books/v1/volumes?q=' . urlencode($q).'&alt=json';
        if ($apiKey) $url .= '&key=' . urlencode($apiKey);
        if ($lang) $url .= '&langRestrict=' . urlencode($lang);

        // Normaliser et borner maxResults (Google Books autorise jusqu'à 40)
        $mr = intval($maxResults);
        if ($mr <= 0) return null;
        if ($mr > 40) $mr = 40;
        $url .= '&maxResults=' . urlencode($mr);

        api_log('identify','DEBUG','Google Books query URL', ['url'=>$url, 'maxResults'=>$mr]);
        $json = curl_get_json($url, $google_books_timeout);
        if (empty($json['items']) || !is_array($json['items'])) return null;

        $results = [];
        foreach ($json['items'] as $item) {
            $v = $item['volumeInfo'] ?? null;
            if (!$v) continue;
            $results[] = [
                'title' => $v['title'] ?? null,
                'authors' => $v['authors'] ?? [],
                'publish_date' => $v['publishedDate'] ?? null,
                'cover' => $v['imageLinks']['thumbnail'] ?? null,
                'raw' => $v
            ];
        }
        api_log('identify','DEBUG','Google Books text query results', ['results_count'=>count($results)]);
        return count($results) ? $results : null;
    };

    return $do_query($q, null);
}

// Interroger OpenLibrary par texte 
function query_openlibrary_by_txt($q, $lang = null, $maxResults) {
    global $main_identify;
    global $open_library_timeout;
    $main_identify = 'text';
    api_log('identify','DEBUG','OpenLibrary text query', ['query'=>$q,'maxResults'=>$maxResults,'lang'=>$lang]);

    $do_query = function($q) use ($maxResults, $lang, $open_library_timeout) {
        // Normaliser et borner maxResults (OpenLibrary accepte des limites raisonnables ; cap à 100)
        $mr = intval($maxResults);
        if ($mr <= 0) return null;
        if ($mr > 100) $mr = 100;

        $url = 'https://openlibrary.org/search.json?q=' . urlencode($q) . '&limit=' . urlencode($mr);

        // Tentative de filtrage par langue (mapping 2 lettres -> code OpenLibrary si possible)
        if ($lang && is_string($lang)) {
            $lang = strtolower(substr(trim($lang), 0, 2));
            $map = ['en' => 'eng', 'fr' => 'fre', 'es' => 'spa'];
            if (isset($map[$lang])) {
                $url .= '&lang=' . urlencode($map[$lang]);
            }
        }

        api_log('identify','DEBUG','OpenLibrary query URL', ['url' => $url, 'maxResults' => $mr, 'timeout'=>$open_library_timeout ]);
        $json = curl_get_json($url, $open_library_timeout);
        if (empty($json['docs']) || !is_array($json['docs'])) return null;

        $results = [];
        foreach ($json['docs'] as $doc) {
            // Titre
            $title = $doc['title'] ?? ($doc['title_suggest'] ?? null);

            // Auteurs (array)
            $authors = [];
            if (!empty($doc['author_name']) && is_array($doc['author_name'])) {
                $authors = $doc['author_name'];
            }

            // Date de publication : préférence pour first_publish_year, fallback sur publish_year[0]
            $publish_date = null;
            if (!empty($doc['first_publish_year'])) {
                $publish_date = $doc['first_publish_year'];
            } elseif (!empty($doc['publish_year']) && is_array($doc['publish_year'])) {
                $publish_date = $doc['publish_year'][0];
            } elseif (!empty($doc['publish_date']) && is_array($doc['publish_date'])) {
                $publish_date = $doc['publish_date'][0];
            }

            // Construire une liste d'images potentielles (cover_i, ISBN)
            $images = [];
            if (!empty($doc['cover_i'])) {
                $images[] = 'https://covers.openlibrary.org/b/id/' . urlencode($doc['cover_i']) . '-M.jpg';
            }
            if (!empty($doc['isbn']) && is_array($doc['isbn'])) {
                foreach ($doc['isbn'] as $isb) {
                    if (empty($isb)) continue;
                    $images[] = 'https://covers.openlibrary.org/b/isbn/' . urlencode($isb) . '-M.jpg';
                }
            }
            // dédupliquer et conserver l'ordre
            $images = array_values(array_unique($images));

            // Cover : prioriser la première image du tableau $images, sinon fallback existant
            $cover = null;
            if (!empty($images[0])) {
                $cover = $images[0];
            } elseif (!empty($doc['cover_i'])) {
                $cover = 'https://covers.openlibrary.org/b/id/' . urlencode($doc['cover_i']) . '-M.jpg';
            } elseif (!empty($doc['isbn']) && is_array($doc['isbn']) && !empty($doc['isbn'][0])) {
                $cover = 'https://covers.openlibrary.org/b/isbn/' . urlencode($doc['isbn'][0]) . '-M.jpg';
            }

            $results[] = [
                'title' => $title,
                'authors' => $authors,
                'publish_date' => $publish_date,
                'cover' => $cover,
                'images' => $images,
                'raw' => $doc
            ];
        }

        return count($results) ? $results : null;
    };

    return $do_query($q, null);
}

// Interroger l'API LEGO par texte (via IDENTIFY_LEGO_URL)
function query_lego_by_txt($q, $lang = null, $maxResults = 10) {
    global $main_identify;
    $main_identify = 'text';

    // Récupérer l'URL de base du service LEGO depuis la configuration
    $baseUrl = getenv('IDENTIFY_LEGO_URL');
    if (empty($baseUrl)) {
        api_log('identify', 'WARN', 'IDENTIFY_LEGO_URL non configuré');
        return null;
    }

    // Convertir le code langue court (fr, en, es) vers le format LEGO (fr-FR, en-GB, es-ES)
    $legoLang = null;
    if ($lang && is_string($lang)) {
        $langCode = strtolower(substr(trim($lang), 0, 2));
        $langMap = [
            'fr' => 'fr-FR',
            'en' => 'en-GB',
            'es' => 'es-ES',
            'de' => 'de-DE',
            'it' => 'it-IT',
            'pt' => 'pt-PT',
            'nl' => 'nl-NL',
            'pl' => 'pl-PL',
            'da' => 'da-DK',
            'sv' => 'sv-SE',
            'no' => 'nb-NO',
            'fi' => 'fi-FI',
            'cs' => 'cs-CZ',
            'hu' => 'hu-HU',
            'ja' => 'ja-JP',
            'ko' => 'ko-KR',
            'zh' => 'zh-CN'
        ];
        $legoLang = $langMap[$langCode] ?? 'fr_FR'; // fallback francasi par défaut
    }

    // Construire l'URL de recherche
    $url = rtrim($baseUrl, '/') . '/search?q=' . urlencode($q);
    if ($legoLang) {
        $url .= '&lang=' . urlencode($legoLang);
    }
    // Limiter le nombre de résultats
    $mr = intval($maxResults);
    if ($mr <= 0) return null;
    if ($mr > 100) $mr = 100;
    $url .= '&limit=' . urlencode($mr);

    api_log('identify', 'DEBUG', 'LEGO query URL', ['url' => $url, 'maxResults' => $mr, 'lang_input' => $lang, 'lang_lego' => $legoLang]);

    // Appel à l'API LEGO
    $json = curl_get_json($url, 15);
    if (empty($json) || !isset($json['products']) || !is_array($json['products'])) {
        api_log('identify', 'DEBUG', 'LEGO query returned no products', ['response' => $json]);
        return null;
    }

    $results = [];
    foreach ($json['products'] as $prod) {
        // Extraire les données du produit LEGO
        $title = $prod['name'] ?? null;
        $productCode = $prod['productCode'] ?? ($prod['id'] ?? null);
        $slug = $prod['slug'] ?? null;
        
        // Images : thumb ou baseImgUrl
        $cover = $prod['thumb'] ?? ($prod['baseImgUrl'] ?? null);
        $images = [];
        if (!empty($prod['thumb'])) $images[] = $prod['thumb'];
        if (!empty($prod['baseImgUrl']) && $prod['baseImgUrl'] !== ($prod['thumb'] ?? '')) {
            $images[] = $prod['baseImgUrl'];
        }

        $results[] = [
            'title' => $title,
            'product_code' => $productCode,
            'slug' => $slug,
            'variant' => $prod['variant'] ?? null,
            'cover' => $cover,
            'images' => $images,
            'raw' => $prod
        ];
    }

    // Ajouter les métadonnées de recherche
    api_log('identify', 'DEBUG', 'LEGO text query results', [
        'results_count' => count($results),
        'total' => $json['total'] ?? null,
        'resultFor' => $json['resultFor'] ?? null
    ]);

    return count($results) ? $results : null;
}

// Interroger l'API LEGO par ID produit (via IDENTIFY_LEGO_URL/product/{id})
function query_lego_by_id($productId, $lang = null) {
    global $main_identify;
    $main_identify = 'code';

    // Récupérer l'URL de base du service LEGO depuis la configuration
    $baseUrl = getenv('IDENTIFY_LEGO_URL');
    if (empty($baseUrl)) {
        api_log('identify', 'WARN', 'IDENTIFY_LEGO_URL non configuré');
        return null;
    }

    // Convertir le code langue court (fr, en, es) vers le format LEGO (fr-FR, en-GB, es-ES)
    $legoLang = null;
    if ($lang && is_string($lang)) {
        $langCode = strtolower(substr(trim($lang), 0, 2));
        $langMap = [
            'fr' => 'fr-FR',
            'en' => 'en-GB',
            'es' => 'es-ES',
            'de' => 'de-DE',
            'it' => 'it-IT',
            'pt' => 'pt-PT',
            'nl' => 'nl-NL',
            'pl' => 'pl-PL',
            'da' => 'da-DK',
            'sv' => 'sv-SE',
            'no' => 'nb-NO',
            'fi' => 'fi-FI',
            'cs' => 'cs-CZ',
            'hu' => 'hu-HU',
            'ja' => 'ja-JP',
            'ko' => 'ko-KR',
            'zh' => 'zh-CN'
        ];
        $legoLang = $langMap[$langCode] ?? 'fr-FR';
    }

    // Construire l'URL de requête produit
    $url = rtrim($baseUrl, '/') . '/product/' . urlencode($productId);
    if ($legoLang) {
        $url .= '?lang=' . urlencode($legoLang);
    }

    api_log('identify', 'DEBUG', 'LEGO product query URL', ['url' => $url, 'productId' => $productId, 'lang_lego' => $legoLang]);

    // Appel à l'API LEGO
    $json = curl_get_json($url, 15);
    if (empty($json) || empty($json['id'])) {
        api_log('identify', 'DEBUG', 'LEGO product query returned no data', ['response' => $json]);
        return null;
    }

    // Extraire les données du produit LEGO
    $prod = $json;
    $title = $prod['name'] ?? null;
    $productCode = $prod['productCode'] ?? ($prod['id'] ?? null);
    $description = $prod['description'] ?? null;

    // Images : tableau complet
    $images = [];
    if (!empty($prod['images']) && is_array($prod['images'])) {
        $images = $prod['images'];
    }
    $cover = !empty($images[0]) ? $images[0] : null;

    // Vidéos
    $videos = [];
    if (!empty($prod['videos']) && is_array($prod['videos'])) {
        $videos = $prod['videos'];
    }

    $result = [
        'title' => $title,
        'product_code' => $productCode,
        'description' => $description,
        'cover' => $cover,
        'images' => $images,
        'videos' => $videos,
        'age_range' => $prod['ageRange'] ?? null,
        'piece_count' => $prod['pieceCount'] ?? null,
        'minifigures_count' => $prod['minifiguresCount'] ?? null,
        'price' => $prod['price'] ?? null,
        'list_price' => $prod['listPrice'] ?? null,
        'availability' => $prod['availability'] ?? null,
        'availability_text' => $prod['availabilityText'] ?? null,
        'rating' => $prod['rating'] ?? null,
        'review_count' => $prod['reviewCount'] ?? null,
        'themes' => $prod['themes'] ?? [],
        'url' => $prod['url'] ?? null,
        'raw' => $prod
    ];

    api_log('identify', 'DEBUG', 'LEGO product query result', [
        'productCode' => $productCode,
        'title' => $title,
        'images_count' => count($images)
    ]);

    return [$result]; // Retourner sous forme de tableau pour cohérence avec les autres providers
}

// Détecte si une chaîne est un ID produit LEGO (nombre entier de 4-6 chiffres)
function is_lego_product_id($s) {
    if (!is_string($s) && !is_numeric($s)) return false;
    $s = trim((string)$s);
    // ID produit LEGO : nombre entier de 4 à 6 chiffres (ex: 10333, 75419, 40179)
    return preg_match('/^\d{4,6}$/', $s) === 1;
}


// Exécute les requêtes de recherche aux providers demandés
function run_search_query_text($code) {
    // Collecte tous les résultats des providers demandés et les retourne
    global $providers, $lang,$lst_provider_info,$isPremium;
    api_log('identify','DEBUG','isPremium value in run_search_query_text', ['is_premium'=>$isPremium]);
    $found = [];
    if (!is_array($providers)) $providers = [];
    api_log('identify','DEBUG','Providers to query', ['providers'=>$providers,'code'=>$code,'lang'=>$lang,'is_premium'=>$isPremium]);
    foreach ($providers as $prov) {
        $prov = strtolower(trim((string)$prov));
        $maxR = $isPremium
            ? ($lst_provider_info[$prov]['max_results_premium'] ?? 0)
            : ($lst_provider_info[$prov]['max_results_free'] ?? 0);

        if ($maxR <= 0) {
            api_log('identify','INFO','Provider skipped due to zero max results for user type', ['provider'=>$prov,'is_premium'=>$isPremium]);
            continue;
        }
        if ($prov === 'google_books') { // 
            $rs = query_google_books_txt($code, $lang, $maxR);
            api_log('identify','DEBUG','Google Books text response', ['response'=>$rs]);
            if ($rs) {
                $found[] = [
                    'type' => $lst_provider_info[$prov]['Type'],
                    'identifier' => $prov,
                    'provider_data' => $rs,
                    'confidence' => 0.8,
                    'source' => $prov
                ];
            }
        } elseif ($prov === 'openlibrary') { // ne tenter OpenLibrary que si code est un ISBN valide
            $rs = query_openlibrary_by_txt($code, $lang, $maxR);
            if ($rs) {
                $found[] = [
                    'type' => $lst_provider_info[$prov]['Type'],
                    'identifier' => $prov,
                    'provider_data' => $rs,
                    'confidence' => 0.8,
                    'source' => $prov
                ];
            }
        } 
        elseif ($prov === 'eandb') { // tenter EAN-DB 
            $rs = query_eandb($code, $maxR);
            if ($rs) {
                $found[] = [
                    'type' => $lst_provider_info[$prov]['Type'],
                    'identifier' => $prov,
                    'provider_data' => $rs,
                    'confidence' => 0.8,
                    'source' => $prov
                ];
            }
        }
        elseif ($prov === 'upcdatabase') { // ne tenter UPCDatabase
            $rs = query_upcdatabase($code, $maxR);
            if ($rs) {
                $found[] = [
                    'type' => $lst_provider_info[$prov]['Type'],
                    'identifier' => $prov,
                    'provider_data' => $rs,
                    'confidence' => 0.8,
                    'source' => $prov
                ];
            }
        }
        elseif ($prov === 'upcitemdb') { // ne tenter UPCItemDB
            $rs = query_upcitemdb($code, $maxR);
            if ($rs) {
                $found[] = [
                    'type' => $lst_provider_info[$prov]['Type'],
                    'identifier' => $prov,
                    'provider_data' => $rs,
                    'confidence' => 0.8,
                    'source' => $prov
                ];
            }
        }
        elseif ($prov === 'lego_api') { // Recherche LEGO via IDENTIFY_LEGO_URL
            // Détecter si c'est un ID produit (nombre entier) ou une recherche texte
            if (is_lego_product_id($code)) {
                // Recherche par ID produit
                $rs = query_lego_by_id($code, $lang);
                api_log('identify', 'DEBUG', 'LEGO product ID response', ['productId' => $code, 'response' => $rs]);
            } else {
                // Recherche par texte
                $rs = query_lego_by_txt($code, $lang, $maxR);
                api_log('identify', 'DEBUG', 'LEGO text response', ['response' => $rs]);
            }
            if ($rs) {
                $found[] = [
                    'type' => $lst_provider_info[$prov]['Type'] ?? 'toys',
                    'identifier' => $prov,
                    'provider_data' => $rs,
                    'confidence' => is_lego_product_id($code) ? 0.95 : 0.85,
                    'source' => $prov
                ];
            }
        }
        else{
            // provider inconnu
            api_log('identify','WARN','Fournisseur inconnu ou non pris en charge', ['provider'=>$prov]);
            json_response(['success'=>false,'message'=>'Type de fournisseur inconnu ou non pris en charge']);
        }        
    }
    api_log('identify','DEBUG','Text search found results', ['count'=>count($found),'results'=>$found]);
    return count($found) ? $found : null;
}
//-----------------------------------------------------------------------------------------------------------
//FIN PARTIE IDENTIFICATION PAR TEXTE
//-----------------------------------------------------------------------------------------------------------







$cacheKey = $code ? 'code:' . normalize_code($code) : 'q:' . substr(md5($q),0,12);
// Détection du flag `force` (GET ou POST) pour forcer le contournement du cache
$force = false;
if (isset($_REQUEST['force'])) {
    $fv = strtolower(trim((string)$_REQUEST['force']));
    if ($fv === '1' || $fv === 'true' || $fv === 'yes') $force = true;
}
if (!empty($_REQUEST['nocache'])) $force = true;

$cached = cache_get($cacheKey);
if ($cached && !$force) {
    api_log('identify','INFO','Cache hit pour la clé d\'identification', ['key'=>$cacheKey]);
    // s'assurer que les réponses en cache contiennent `providers` pour compatibilité avec les clients
    if (is_array($cached) && isset($cached['source']) && !isset($cached['providers'])) {
        $cached['providers'] = $cached['source'];
    }
    // marquer que cette réponse provient du cache
    $cached = array_merge(['cached' => true], $cached);

    // Ajouter un indicateur d'âge/date basé sur le fichier cache
    $cacheFile = $baseCacheDir . '/' . preg_replace('/[^a-zA-Z0-9_\-\.]/', '_', $cacheKey) . '.json';
    if (is_file($cacheFile)) {
        $mtime = @filemtime($cacheFile);
        if ($mtime !== false) {
            $cached['cache_mtime'] = date('c', $mtime);
            $cached['cache_age_seconds'] = time() - $mtime;
        }
    }

    api_log('identify','INFO','Résultat d\'identification servi depuis le cache', ['key'=>$cacheKey,'age_seconds'=>$cached['cache_age_seconds'] ?? null]);
    json_response($cached);
} elseif ($cached && $force) {
    api_log('identify','INFO','Bypass du cache demandé (force=1) — exécution d\'une recherche fraîche', ['key'=>$cacheKey]);
}




$result = null;
$source = null;
$confidence = 0.0;


if ($code) {
    $norm = normalize_code($code);
    $isbn_candidate = false;
    $upc_candidate = false;
    // Si ressemble à ISBN (10 ou 13)
    if (preg_match('/^\d{9}[\dXx]$|^\d{13}$/', $norm)) {
        // normaliser ISBN10 -> 13 si besoin
        if (preg_match('/^\d{9}[\dXx]$/', $norm)) {
            $maybe13 = isbn10_to_isbn13($norm);
            if ($maybe13) $norm = $maybe13;
        }
        if (isbn_valid($norm)) {
            $isbn_candidate = true;
        }
        $result = run_search_query_code($norm, $isbn_candidate, $upc_candidate);
    }else{
        // EAN (European Article Number)/UPC (Universal Product Code)
        // Les livres utilisent un EAN spécial : GS1 / Bookland EAN (commence par 978 ou 979)
        // Probable EAN/UPC -> tenter UPCItemDB        
        $upc = $norm;
        if (preg_match('/^\d{8,13}$/', $upc)) {
            $upc_candidate = true;
            $result = run_search_query_code($norm, $upc_candidate, $upc_candidate);
            $up = query_upcitemdb($upc);
            if ($up) { $result=$up; $source='upcitemdb'; $confidence=0.75; }
        }
    }
    // Si la valeur ne ressemble pas à un code mais plutôt à un texte (titre/nom),
    // tenter une recherche texte via les providers configurés.
    if (is_text_search_candidate($code)) {
        $result = run_search_query_text($code);
    }
}




if (!$result) {
    $out = ['success'=>false,'message'=>'no_match'];
    cache_set($cacheKey, $out);
    json_response($out);
}

$out = [
    'success'=>true,
    'type' => $type,
    'lang' => $lang,
    'api' => (count($providers) === 1 ? $providers[0] : $providers),
    'providers' => $providers,
    'identifier' => ['type' => $main_identify, 'value' => $code ?: $q],
    'lst_resultat' => $result,
];

cache_set($cacheKey, $out);
json_response($out);
