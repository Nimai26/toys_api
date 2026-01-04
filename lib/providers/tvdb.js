/**
 * lib/providers/tvdb.js - Provider TVDB
 * 
 * API TVDB pour recherche et détails de séries/films
 * Nécessite une clé API TVDB
 * Support traduction via auto_trad (autoTrad=1)
 * 
 * @module providers/tvdb
 */

import { metrics } from '../utils/state.js';
import { createLogger } from '../utils/logger.js';
import { translateText, translateGenres, extractLangCode } from '../utils/translator.js';
import {
  TVDB_BASE_URL,
  TVDB_DEFAULT_MAX,
  TVDB_MAX_LIMIT
} from '../config.js';
import { fetchViaProxy } from '../utils/fetch-proxy.js';

// Import des normalizers v3.0.0
import {
  normalizeTvdbMovieSearch,
  normalizeTvdbMovieDetail,
  normalizeTvdbSeriesSearch,
  normalizeTvdbSeriesDetail
} from '../normalizers/index.js';

const log = createLogger('TVDB');

// ============================================================================
// CONVERSION ISO 639-1 → ISO 639-2 (TVDB utilise ISO 639-2)
// ============================================================================

const ISO_639_1_TO_2 = {
  'fr': 'fra', 'en': 'eng', 'de': 'deu', 'es': 'spa', 'it': 'ita',
  'pt': 'por', 'nl': 'nld', 'ru': 'rus', 'ja': 'jpn', 'ko': 'kor',
  'zh': 'zho', 'ar': 'ara', 'pl': 'pol', 'sv': 'swe', 'da': 'dan',
  'no': 'nor', 'fi': 'fin', 'cs': 'ces', 'hu': 'hun', 'el': 'ell',
  'tr': 'tur', 'he': 'heb', 'th': 'tha', 'vi': 'vie', 'id': 'ind',
  'uk': 'ukr', 'ro': 'ron', 'bg': 'bul', 'hr': 'hrv', 'sk': 'slk'
};

/**
 * Convertit un code langue ISO 639-1 (fr) en ISO 639-2 (fra) pour TVDB
 * @param {string} lang - Code langue (peut être ISO 639-1 ou déjà ISO 639-2)
 * @returns {string|null} - Code ISO 639-2 ou null
 */
function toIso6392(lang) {
  if (!lang) return null;
  const code = lang.toLowerCase().split('-')[0]; // fr-FR → fr
  // Si déjà 3 caractères, probablement ISO 639-2
  if (code.length === 3) return code;
  // Conversion ISO 639-1 → ISO 639-2
  return ISO_639_1_TO_2[code] || null;
}

// ============================================================================
// CACHE GLOBAL POUR TOKENS TVDB
// ============================================================================

const tvdbTokenCache = {
  token: null,
  expiresAt: 0
};

// ============================================================================
// AUTHENTIFICATION
// ============================================================================

/**
 * Obtient un token d'accès TVDB
 * Token valide ~1 mois
 * @param {string} apiKey - Clé API TVDB
 * @returns {Promise<string>} - Token d'accès
 */
export async function getTvdbToken(apiKey) {
  if (tvdbTokenCache.token && Date.now() < tvdbTokenCache.expiresAt) {
    log.debug(`Utilisation du token en cache`);
    return tvdbTokenCache.token;
  }
  
  log.debug(`Obtention d'un nouveau token...`);
  
  try {
    const response = await fetchViaProxy(`${TVDB_BASE_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ apikey: apiKey })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erreur login TVDB ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    
    // Le token TVDB est valide ~1 mois, on le cache pour 25 jours
    tvdbTokenCache.token = data.data.token;
    tvdbTokenCache.expiresAt = Date.now() + (25 * 24 * 60 * 60 * 1000);
    
    log.debug(`✅ Token obtenu, expire dans 25 jours`);
    return data.data.token;
    
  } catch (err) {
    log.error(`Erreur login:`, err.message);
    throw err;
  }
}

// ============================================================================
// RECHERCHE
// ============================================================================

/**
 * Recherche sur TVDB (séries, films, personnes, compagnies)
 * @param {string} query - Terme de recherche
 * @param {string} apiKey - Clé API TVDB
 * @param {object} options - Options de recherche
 * @returns {Promise<object>} - Résultats de recherche
 */
export async function searchTvdb(query, apiKey, options = {}) {
  const {
    max = TVDB_DEFAULT_MAX,
    type = null,      // series, movie, person, company
    lang = null,      // Code langue (fr, en, fra, eng, etc.)
    year = null       // Année de sortie
  } = options;
  
  // Conversion ISO 639-1 → ISO 639-2 pour TVDB
  const tvdbLang = toIso6392(lang);
  
  const cacheKey = `tvdb_search_${query}_${max}_${type}_${tvdbLang}_${year}`;
  
  log.debug(`Recherche: "${query}" (type: ${type || 'all'}, lang: ${tvdbLang || 'default'}, max: ${max})`);
  metrics.sources.tvdb.requests++;
  
  try {
    const token = await getTvdbToken(apiKey);
    
    const params = new URLSearchParams({ query });
    if (type) params.append('type', type);
    if (tvdbLang) params.append('language', tvdbLang);
    if (year) params.append('year', year);
    params.append('limit', Math.min(max, TVDB_MAX_LIMIT));
    
    const url = `${TVDB_BASE_URL}/search?${params.toString()}`;
    
    const response = await fetchViaProxy(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erreur TVDB ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    
    const results = (data.data || []).slice(0, max).map(item => ({
      id: item.tvdb_id || item.id,
      type: item.type || null,
      name: item.name || item.title,
      slug: item.slug,
      year: item.year || (item.first_air_time ? new Date(item.first_air_time).getFullYear() : null),
      overview: item.overview || null,
      overviews: item.overviews || null,
      primaryLanguage: item.primary_language || null,
      status: item.status || null,
      network: item.network || null,
      country: item.country || null,
      thumbnail: item.thumbnail || item.image_url || null,
      image: item.image || item.image_url || null,
      aliases: item.aliases || [],
      objectID: item.objectID,
      url: item.type === 'series' 
        ? `https://thetvdb.com/series/${item.slug}`
        : item.type === 'movie'
        ? `https://thetvdb.com/movies/${item.slug}`
        : `https://thetvdb.com/search?query=${encodeURIComponent(item.name || query)}`,
      source: "tvdb"
    }));
    
    const result = {
      query,
      type: type || 'all',
      total: results.length,
      results,
      source: "tvdb"
    };
    
    log.debug(`✅ ${results.length} résultat(s) trouvé(s)`);
    return result;
    
  } catch (err) {
    metrics.sources.tvdb.errors++;
    throw err;
  }
}

// ============================================================================
// DÉTAILS SÉRIE
// ============================================================================

/**
 * Récupère les détails d'une série TVDB par ID
 * @param {string|number} id - ID de la série
 * @param {string} apiKey - Clé API TVDB
 * @param {object} options - Options (lang, autoTrad)
 * @returns {Promise<object>} - Détails de la série
 */
export async function getTvdbSeriesById(id, apiKey, options = {}) {
  const { lang = null, autoTrad = false } = options;
  const destLang = extractLangCode(lang);
  const tvdbLang = toIso6392(lang);
  const shouldTranslate = autoTrad === true || autoTrad === 1 || autoTrad === '1';
  
  const cacheKey = `tvdb_series_${id}_${tvdbLang}_${shouldTranslate ? 'trad' : 'notrad'}`;
  
  log.debug(`Récupération série: ${id} (lang: ${tvdbLang}, autoTrad: ${shouldTranslate})`);
  metrics.sources.tvdb.requests++;
  
  try {
    const token = await getTvdbToken(apiKey);
    
    // TVDB v4 API: short=true inclut companies dans la réponse extended
    // meta=translations pour les traductions disponibles
    const url = `${TVDB_BASE_URL}/series/${id}/extended?short=false`;
    
    const response = await fetchViaProxy(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Série TVDB ${id} non trouvée`);
      }
      const errorText = await response.text();
      throw new Error(`Erreur TVDB ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    const series = data.data;
    
    // Debug: voir les champs disponibles
    log.debug(`TVDB série ${id} - companies: ${series.companies?.length || 0}, characters: ${series.characters?.length || 0}`);
    log.debug(`TVDB série ${id} - originalNetwork: ${series.originalNetwork?.name || 'N/A'}, latestNetwork: ${series.latestNetwork?.name || 'N/A'}`);
    if (series.companies?.length > 0) {
      log.debug(`Companies: ${JSON.stringify(series.companies.slice(0, 3))}`);
    }
    
    // Récupère les traductions si langue spécifiée
    let translations = null;
    if (lang) {
      try {
        const transResponse = await fetchViaProxy(`${TVDB_BASE_URL}/series/${id}/translations/${lang}`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });
        if (transResponse.ok) {
          const transData = await transResponse.json();
          translations = transData.data;
        }
      } catch (e) {
        log.debug(`Pas de traduction ${lang} pour série ${id}`);
      }
    }
    
    // Prépare les genres
    const genresList = Array.isArray(series.genres) ? series.genres.map(g => g.name) : [];
    
    // Applique la traduction si demandée
    let finalOverview = translations?.overview || series.overview;
    let overviewOriginal = series.overview;
    let overviewTranslated = null;
    let translatedGenresList = null;
    let genresOriginalList = genresList;
    let genresWereTranslated = false;
    
    if (shouldTranslate && destLang) {
      // Traduit l'overview si pas déjà traduit par TVDB
      if (series.overview && !translations?.overview) {
        const translateResult = await translateText(series.overview, destLang, { enabled: true });
        // translateText retourne { text: string, translated: boolean }
        const translatedText = translateResult?.text || translateResult;
        const wasTranslated = translateResult?.translated === true;
        if (wasTranslated && translatedText !== series.overview) {
          finalOverview = translatedText;
          overviewTranslated = translatedText;
        }
      } else if (translations?.overview) {
        overviewTranslated = translations.overview;
        finalOverview = translations.overview;
      }
      
      // Traduit les genres
      if (genresList.length > 0) {
        const genresResult = await translateGenres(genresList, destLang, 'media');
        translatedGenresList = genresResult.genres;
        genresOriginalList = genresResult.genresOriginal || genresList;
        genresWereTranslated = genresResult.genresTranslated === true;
      }
    }
    
    const result = {
      id: series.id,
      type: 'series',
      // Clés harmonisées (prioritaires)
      title: translations?.name || series.name,
      originalTitle: series.name,
      overview: finalOverview,
      overviewOriginal: overviewOriginal,
      overviewTranslated: overviewTranslated,
      year: series.year,
      endYear: series.lastAired ? new Date(series.lastAired).getFullYear() : null,
      status: series.status?.name || null,
      poster: series.image,
      rating: series.score ? { average: series.score, votes: null } : null,
      runtimeMinutes: series.averageRuntime || null,
      // Clés spécifiques TVDB (rétro-compatibilité)
      name: translations?.name || series.name,
      originalName: series.name,
      slug: series.slug,
      firstAired: series.firstAired,
      lastAired: series.lastAired,
      nextAired: series.nextAired,
      averageRuntime: series.averageRuntime,
      score: series.score,
      originalCountry: series.originalCountry,
      originalLanguage: series.originalLanguage,
      defaultSeasonType: series.defaultSeasonType,
      isOrderRandomized: series.isOrderRandomized,
      lastUpdated: series.lastUpdated,
      
      image: series.image,
      artworks: series.artworks?.slice(0, 20).map(a => ({
        id: a.id,
        type: a.type,
        image: a.image,
        thumbnail: a.thumbnail,
        language: a.language,
        score: a.score
      })) || [],
      
      genres: translatedGenresList || genresList,
      genresOriginal: genresOriginalList,
      genresTranslated: genresWereTranslated ? translatedGenresList : null,
      genresFull: Array.isArray(series.genres) ? series.genres.map(g => ({
        id: g.id,
        name: g.name,
        slug: g.slug
      })) : [],
      
      // Extraction des rôles
      cast: Array.isArray(series.characters) ? series.characters
        .filter(c => c.peopleType === 'Actor' || c.isFeatured || (c.personName && !['Director', 'Writer', 'Producer', 'Creator'].includes(c.peopleType)))
        .slice(0, 20)
        .map(c => ({
          id: c.id,
          name: c.name,
          peopleId: c.peopleId,
          personName: c.personName,
          character: c.name,
          image: c.image
        })) : [],
      
      // Directors: chercher dans characters ET people
      directors: [
        ...(Array.isArray(series.characters) ? series.characters.filter(c => c.peopleType === 'Director') : []),
        ...(Array.isArray(series.people) ? series.people.filter(p => p.peopleType === 'Director' || p.role === 'Director') : [])
      ].map(c => ({
        id: c.peopleId || c.id,
        name: c.personName || c.name,
        image: c.image
      })),
      
      // Writers: chercher dans characters ET people
      writers: [
        ...(Array.isArray(series.characters) ? series.characters.filter(c => c.peopleType === 'Writer' || c.peopleType === 'Screenplay') : []),
        ...(Array.isArray(series.people) ? series.people.filter(p => p.peopleType === 'Writer' || p.role === 'Writer') : [])
      ].map(c => ({
        id: c.peopleId || c.id,
        name: c.personName || c.name,
        image: c.image
      })),
      
      // Creators: chercher dans characters ET people
      creators: [
        ...(Array.isArray(series.characters) ? series.characters.filter(c => c.peopleType === 'Creator') : []),
        ...(Array.isArray(series.people) ? series.people.filter(p => p.peopleType === 'Creator' || p.role === 'Creator') : [])
      ].map(c => ({
        id: c.peopleId || c.id,
        name: c.personName || c.name,
        image: c.image
      })),
      
      // Tous les characters pour rétro-compatibilité
      characters: Array.isArray(series.characters) ? series.characters.slice(0, 30).map(c => ({
        id: c.id,
        name: c.name,
        peopleId: c.peopleId,
        personName: c.personName,
        image: c.image,
        type: c.type,
        peopleType: c.peopleType,
        sort: c.sort
      })) : [],
      
      // Champ people brut pour debug
      people: Array.isArray(series.people) ? series.people.slice(0, 30).map(p => ({
        id: p.id,
        name: p.name || p.personName,
        peopleType: p.peopleType,
        role: p.role,
        image: p.image
      })) : [],
      
      // Infos saisons harmonisées avec IMDB
      totalSeasons: series.seasons?.filter(s => s.type?.name === 'Aired Order' || s.type?.id === 1).length || series.seasons?.length || 0,
      totalEpisodes: series.episodes?.length || null,
      
      companies: Array.isArray(series.companies) ? series.companies.map(c => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        country: c.country,
        activeDate: c.activeDate,
        companyType: c.companyType?.name || c.companyType
      })) : [],
      
      // Networks (chaînes de diffusion)
      originalNetwork: series.originalNetwork ? {
        id: series.originalNetwork.id,
        name: series.originalNetwork.name,
        slug: series.originalNetwork.slug,
        country: series.originalNetwork.country
      } : null,
      latestNetwork: series.latestNetwork ? {
        id: series.latestNetwork.id,
        name: series.latestNetwork.name,
        slug: series.latestNetwork.slug,
        country: series.latestNetwork.country
      } : null,
      
      remoteIds: series.remoteIds || [],
      trailers: Array.isArray(series.trailers) ? series.trailers.map(t => ({
        id: t.id,
        name: t.name,
        url: t.url,
        runtime: t.runtime,
        language: t.language
      })) : [],
      
      // Sagas/Franchises
      lists: Array.isArray(series.lists) ? series.lists.slice(0, 10).map(l => ({
        id: l.id,
        name: l.name,
        overview: l.overview,
        url: l.url,
        isOfficial: l.isOfficial
      })) : [],
      
      // Collection/Saga principale
      collection: Array.isArray(series.lists) && series.lists.length > 0 ? (() => {
        const official = series.lists.find(l => l.isOfficial);
        const first = official || series.lists[0];
        return {
          id: first.id,
          name: first.name,
          overview: first.overview
        };
      })() : null,
      
      contentRatings: series.contentRatings || [],
      
      url: `https://thetvdb.com/series/${series.slug}`,
      source: "tvdb"
    };
    
    log.debug(`✅ Série récupérée: ${result.name}`);
    return result;
    
  } catch (err) {
    metrics.sources.tvdb.errors++;
    throw err;
  }
}

// ============================================================================
// DÉTAILS FILM
// ============================================================================

/**
 * Récupère les détails d'un film TVDB par ID
 * @param {string|number} id - ID du film
 * @param {string} apiKey - Clé API TVDB
 * @param {object} options - Options (lang, autoTrad)
 * @returns {Promise<object>} - Détails du film
 */
export async function getTvdbMovieById(id, apiKey, options = {}) {
  const { lang = null, autoTrad = false } = options;
  const destLang = extractLangCode(lang);
  const tvdbLang = toIso6392(lang);
  const shouldTranslate = autoTrad === true || autoTrad === 1 || autoTrad === '1';
  
  const cacheKey = `tvdb_movie_${id}_${tvdbLang}_${shouldTranslate ? 'trad' : 'notrad'}`;
  
  console.log('[DEBUG TVDB] Fetching from API...');
  log.debug(`Récupération film: ${id} (lang: ${tvdbLang})`);
  metrics.sources.tvdb.requests++;
  
  try {
    const token = await getTvdbToken(apiKey);
    
    // meta=people pour inclure toute l'équipe (directors, writers, etc.)
    const url = `${TVDB_BASE_URL}/movies/${id}/extended?meta=people`;
    
    const response = await fetchViaProxy(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Film TVDB ${id} non trouvé`);
      }
      const errorText = await response.text();
      throw new Error(`Erreur TVDB ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    const movie = data.data;
    
    // TVDB v4 API structure:
    // - overview n'existe pas directement, il faut utiliser les translations
    // - overviewTranslations contient les langues disponibles
    // - companies peut être un objet ou un tableau
    // - studios est un tableau séparé
    
    // Récupère l'overview depuis les traductions anglaises par défaut
    let baseOverview = null;
    if (movie.overviewTranslations && movie.overviewTranslations.includes('eng')) {
      try {
        const engResponse = await fetchViaProxy(`${TVDB_BASE_URL}/movies/${id}/translations/eng`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });
        if (engResponse.ok) {
          const engData = await engResponse.json();
          baseOverview = engData.data?.overview;
        }
      } catch (e) {
        log.debug(`Pas de traduction eng pour film ${id}`);
      }
    }
    
    // Récupère les traductions si langue spécifiée
    let translations = null;
    if (lang) {
      try {
        const transResponse = await fetchViaProxy(`${TVDB_BASE_URL}/movies/${id}/translations/${lang}`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });
        if (transResponse.ok) {
          const transData = await transResponse.json();
          translations = transData.data;
        }
      } catch (e) {
        log.debug(`Pas de traduction ${lang} pour film ${id}`);
      }
    }
    
    // Prépare les genres
    const genresList = Array.isArray(movie.genres) ? movie.genres.map(g => g.name) : [];
    
    // Applique la traduction si demandée
    let finalOverview = translations?.overview || baseOverview;
    let overviewOriginal = baseOverview;
    let overviewTranslated = null;
    let translatedGenresList = null;
    let genresOriginalList = genresList;
    let genresWereTranslated = false;
    
    if (shouldTranslate && destLang) {
      // Traduit l'overview si pas déjà traduit par TVDB
      if (baseOverview && !translations?.overview) {
        const translationResult = await translateText(baseOverview, destLang, { enabled: true });
        if (translationResult.translated && translationResult.text !== baseOverview) {
          finalOverview = translationResult.text;
          overviewTranslated = translationResult.text;
        }
      } else if (translations?.overview) {
        finalOverview = translations.overview;
        overviewTranslated = translations.overview;
      }
      
      // Traduit les genres
      if (genresList.length > 0) {
        const genresResult = await translateGenres(genresList, destLang, 'media');
        translatedGenresList = genresResult.genres;
        genresOriginalList = genresResult.genresOriginal || genresList;
        genresWereTranslated = genresResult.genresTranslated === true;
      }
    }
    
    const result = {
      id: movie.id,
      type: 'movie',
      // Clés harmonisées
      title: translations?.name || movie.name,
      originalTitle: movie.name,
      overview: finalOverview,
      overviewOriginal: overviewOriginal,
      overviewTranslated: overviewTranslated,
      year: movie.year,
      status: movie.status?.name || null,
      poster: movie.image,
      rating: movie.score ? { average: movie.score, votes: null } : null,
      runtimeMinutes: movie.runtime || null,
      // Clés spécifiques (rétro-compatibilité)
      name: translations?.name || movie.name,
      originalName: movie.name,
      slug: movie.slug,
      runtime: movie.runtime,
      score: movie.score,
      originalCountry: movie.originalCountry,
      originalLanguage: movie.originalLanguage,
      lastUpdated: movie.lastUpdated,
      
      releases: Array.isArray(movie.releases) ? movie.releases.map(r => ({
        country: r.country,
        date: r.date,
        detail: r.detail
      })) : [],
      
      image: movie.image,
      artworks: movie.artworks?.slice(0, 20).map(a => ({
        id: a.id,
        type: a.type,
        image: a.image,
        thumbnail: a.thumbnail,
        language: a.language,
        score: a.score
      })) || [],
      
      genres: translatedGenresList || genresList,
      genresOriginal: genresOriginalList,
      genresTranslated: genresWereTranslated ? translatedGenresList : null,
      genresFull: Array.isArray(movie.genres) ? movie.genres.map(g => ({
        id: g.id,
        name: g.name,
        slug: g.slug
      })) : [],
      
      // Extraction des rôles
      // TVDB renvoie les acteurs dans 'characters' et l'équipe technique peut être dans 'people' ou 'characters' avec peopleType
      cast: Array.isArray(movie.characters) ? movie.characters
        .filter(c => c.peopleType === 'Actor' || c.isFeatured || (c.personName && !['Director', 'Writer', 'Producer', 'Creator'].includes(c.peopleType)))
        .slice(0, 20)
        .map(c => ({
          id: c.id,
          name: c.name,
          peopleId: c.peopleId,
          personName: c.personName,
          character: c.name,
          image: c.image
        })) : [],
      
      // Directors: chercher dans characters ET people
      directors: [
        ...(Array.isArray(movie.characters) ? movie.characters.filter(c => c.peopleType === 'Director') : []),
        ...(Array.isArray(movie.people) ? movie.people.filter(p => p.peopleType === 'Director' || p.role === 'Director') : [])
      ].map(c => ({
        id: c.peopleId || c.id,
        name: c.personName || c.name,
        image: c.image
      })),
      
      // Writers: chercher dans characters ET people
      writers: [
        ...(Array.isArray(movie.characters) ? movie.characters.filter(c => c.peopleType === 'Writer' || c.peopleType === 'Screenplay') : []),
        ...(Array.isArray(movie.people) ? movie.people.filter(p => p.peopleType === 'Writer' || p.role === 'Writer' || p.peopleType === 'Screenplay') : [])
      ].map(c => ({
        id: c.peopleId || c.id,
        name: c.personName || c.name,
        image: c.image
      })),
      
      // Producers: chercher dans characters ET people
      producers: [
        ...(Array.isArray(movie.characters) ? movie.characters.filter(c => c.peopleType === 'Producer') : []),
        ...(Array.isArray(movie.people) ? movie.people.filter(p => p.peopleType === 'Producer' || p.role === 'Producer') : [])
      ].map(c => ({
        id: c.peopleId || c.id,
        name: c.personName || c.name,
        image: c.image
      })),
      
      // Tous les characters pour debug et rétro-compatibilité
      characters: Array.isArray(movie.characters) ? movie.characters.slice(0, 50).map(c => ({
        id: c.id,
        name: c.name,
        peopleId: c.peopleId,
        personName: c.personName,
        image: c.image,
        type: c.type,
        peopleType: c.peopleType,
        isFeatured: c.isFeatured,
        sort: c.sort
      })) : [],
      
      // Champ people brut pour debug
      people: Array.isArray(movie.people) ? movie.people.slice(0, 30).map(p => ({
        id: p.id,
        name: p.name || p.personName,
        peopleType: p.peopleType,
        role: p.role,
        image: p.image
      })) : [],
      
      // Sagas/Collections (lists contient les franchises)
      lists: Array.isArray(movie.lists) ? movie.lists.map(l => ({
        id: l.id,
        name: l.name,
        overview: l.overview,
        url: l.url,
        isOfficial: l.isOfficial
      })) : [],
      
      // Collection/Saga principale (première liste officielle ou première liste)
      collection: Array.isArray(movie.lists) && movie.lists.length > 0 ? (() => {
        const official = movie.lists.find(l => l.isOfficial);
        const first = official || movie.lists[0];
        return {
          id: first.id,
          name: first.name,
          overview: first.overview
        };
      })() : null,
      
      // companies peut être un objet ou un tableau dans TVDB v4
      companies: Array.isArray(movie.companies) ? movie.companies.map(c => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        country: c.country,
        companyType: c.companyType?.name || c.companyType
      })) : [],
      
      // studios est un champ séparé dans TVDB v4 (contient les studios de production)
      studios: Array.isArray(movie.studios) ? movie.studios.map(s => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        country: s.country
      })) : [],
      
      boxOffice: movie.boxOffice,
      boxOfficeUS: movie.boxOfficeUS,
      budget: movie.budget,
      
      trailers: Array.isArray(movie.trailers) ? movie.trailers.map(t => ({
        id: t.id,
        name: t.name,
        url: t.url,
        runtime: t.runtime,
        language: t.language
      })) : [],
      
      remoteIds: movie.remoteIds || [],
      // contentRatings: structure TVDB avec name=rating et country
      contentRatings: Array.isArray(movie.contentRatings) ? movie.contentRatings.map(c => ({
        country: c.country,
        name: c.name,  // Le rating est dans 'name' pour TVDB
        fullName: c.fullName,
        contentType: c.contentType
      })) : [],
      
      url: `https://thetvdb.com/movies/${movie.slug}`,
      source: "tvdb"
    };
    
    log.debug(`✅ Film récupéré: ${result.name}`);
    return result;
    
  } catch (err) {
    metrics.sources.tvdb.errors++;
    throw err;
  }
}

// ============================================================================
// FONCTIONS NORMALISÉES v3.0.0
// ============================================================================

/**
 * Recherche TVDB avec résultats normalisés (films)
 * @param {string} query - Terme de recherche
 * @param {string} apiKey - Clé API TVDB
 * @param {object} options - Options de recherche
 * @returns {Promise<object>} - Résultats normalisés
 */
export async function searchTvdbMovieNormalized(query, apiKey, options = {}) {
  const result = await searchTvdb(query, apiKey, { ...options, type: 'movie' });
  return normalizeTvdbMovieSearch(result);
}

/**
 * Recherche TVDB avec résultats normalisés (séries)
 * @param {string} query - Terme de recherche
 * @param {string} apiKey - Clé API TVDB
 * @param {object} options - Options de recherche
 * @returns {Promise<object>} - Résultats normalisés
 */
export async function searchTvdbSeriesNormalized(query, apiKey, options = {}) {
  const result = await searchTvdb(query, apiKey, { ...options, type: 'series' });
  return normalizeTvdbSeriesSearch(result);
}

/**
 * Détails film TVDB normalisés
 * @param {string|number} id - ID du film
 * @param {string} apiKey - Clé API TVDB
 * @param {object} options - Options
 * @returns {Promise<object>} - Détails normalisés
 */
export async function getTvdbMovieByIdNormalized(id, apiKey, options = {}) {
  const result = await getTvdbMovieById(id, apiKey, options);
  return normalizeTvdbMovieDetail(result);
}

/**
 * Détails série TVDB normalisés
 * @param {string|number} id - ID de la série
 * @param {string} apiKey - Clé API TVDB
 * @param {object} options - Options
 * @returns {Promise<object>} - Détails normalisés
 */
export async function getTvdbSeriesByIdNormalized(id, apiKey, options = {}) {
  const result = await getTvdbSeriesById(id, apiKey, options);
  return normalizeTvdbSeriesDetail(result);
}
