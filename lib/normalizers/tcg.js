/**
 * Normalizers TCG (Trading Card Games)
 * 
 * Normalise les données brutes des différentes APIs TCG
 * vers un format standardisé unifié
 */

import { logger } from '../utils/logger.js';

/**
 * Helper: Traduit du texte via auto_trad
 * @param {string} text - Texte à traduire
 * @param {object} options - Options { from, to }
 * @returns {Promise<string>} - Texte traduit
 */
async function translateText(text, options = {}) {
  const { from = 'en', to = 'fr' } = options;
  
  if (!text || from === to) return text;
  
  try {
    const response = await fetch(`http://auto_trad:3255/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        source_lang: from,
        target_lang: to
      })
    });
    
    if (!response.ok) {
      logger.warn(`[TCG Normalizer] Translation failed: ${response.status}`);
      return text; // Fallback vers le texte original
    }
    
    const data = await response.json();
    // Format auto_trad: { results: [{ translated: "..." }] }
    return data.results?.[0]?.translated || data.translated_text || text;
  } catch (error) {
    logger.error(`[TCG Normalizer] Translation error: ${error.message}`);
    return text; // Fallback vers le texte original
  }
}

/**
 * Normalise les résultats de recherche Pokémon TCG
 * @param {object} rawData - Données brutes de l'API Pokémon TCG
 * @param {object} options - Options { lang, autoTrad }
 * @returns {Promise<object>} - Résultats normalisés
 */
export async function normalizePokemonSearch(rawData, options = {}) {
  const { lang = 'fr' } = options;

  if (!rawData || !rawData.data) {
    return {
      total: 0,
      count: 0,
      page: 1,
      totalPages: 0,
      results: []
    };
  }

  const results = rawData.data.map(card => {
    const setTotal = card.set?.printedTotal || card.set?.total || 0;
    const year = card.set?.releaseDate ? parseInt(card.set.releaseDate.split('-')[0]) : null;

    return {
      id: card.id,
      source: 'tcg_pokemon',
      collection: 'Pokémon TCG',
      name: card.name,
      image: card.images?.small || null,
      set: {
        id: card.set?.id || null,
        name: card.set?.name || null,
        code: card.set?.series || null
      },
      card_number: card.number ? `${card.number}/${setTotal}` : null,
      rarity: card.rarity || null,
      type: card.supertype || null,
      year,
      detailUrl: `/tcg_pokemon/card?id=${card.id}&lang=${lang}`
    };
  });

  return {
    total: rawData.totalCount || results.length,
    count: results.length,
    page: rawData.page || 1,
    totalPages: Math.ceil((rawData.totalCount || results.length) / (rawData.pageSize || 20)),
    results
  };
}

/**
 * Normalise une carte Pokémon TCG
 * @param {object} rawCard - Données brutes de la carte
 * @param {object} options - Options { lang, autoTrad }
 * @returns {Promise<object>} - Carte normalisée
 */
export async function normalizePokemonCard(rawCard, options = {}) {
  const { lang = 'fr', autoTrad = false } = options;

  if (!rawCard || !rawCard.data) return null;

  const card = rawCard.data;

  // === Images ===
  const images = [];
  if (card.images?.large) {
    images.push({
      url: card.images.large,
      thumbnail: card.images.small || card.images.large,
      caption: 'normal',
      is_main: true
    });
  }

  // === Description (concaténer capacités et attaques) ===
  let description = '';
  
  if (card.abilities && card.abilities.length > 0) {
    const abilitiesText = card.abilities.map(a => {
      const abilityType = a.type || 'Ability';
      return `**${a.name}** (${abilityType}): ${a.text || 'No description'}`;
    }).join('\n\n');
    description += abilitiesText;
  }
  
  if (card.attacks && card.attacks.length > 0) {
    if (description) description += '\n\n';
    const attacksText = card.attacks.map(a => {
      const cost = a.cost ? a.cost.join('') : '';
      const damage = a.damage || '';
      return `**${a.name}** ${cost ? `(${cost})` : ''}: ${a.text || ''} ${damage ? `[${damage}]` : ''}`.trim();
    }).join('\n\n');
    description += attacksText;
  }

  // Traduction automatique si demandée
  if (autoTrad && description && lang !== 'en') {
    try {
      description = await translateText(description, { from: 'en', to: lang });
    } catch (error) {
      logger.warn(`[Pokemon TCG] Translation failed for card ${card.id}`);
      // Garder la version originale en cas d'erreur
    }
  }

  // Flavor text (texte d'ambiance)
  let flavorText = card.flavorText || null;
  if (autoTrad && flavorText && lang !== 'en') {
    try {
      flavorText = await translateText(flavorText, { from: 'en', to: lang });
    } catch (error) {
      // Garder la version originale
    }
  }

  // === Set ===
  const setTotal = card.set?.printedTotal || card.set?.total || null;
  const year = card.set?.releaseDate ? parseInt(card.set.releaseDate.split('-')[0]) : null;

  // === Prix ===
  let prices = null;
  if (card.tcgplayer?.prices) {
    const tcgPrices = card.tcgplayer.prices;
    
    // Prioriser holofoil, puis normal, puis 1stEditionHolofoil, etc.
    const priceVariant = tcgPrices.holofoil || tcgPrices.normal || 
                         tcgPrices['1stEditionHolofoil'] || tcgPrices['1stEditionNormal'] ||
                         tcgPrices.reverseHolofoil || tcgPrices.unlimitedHolofoil ||
                         Object.values(tcgPrices)[0];
    
    if (priceVariant) {
      prices = {
        usd: {
          low: priceVariant.low || null,
          mid: priceVariant.mid || null,
          high: priceVariant.high || null,
          market: priceVariant.market || null
        },
        source: 'tcgplayer',
        updated_at: card.tcgplayer.updatedAt || null
      };
    }
  }

  // === Attributs spécifiques Pokémon ===
  const attributes = {
    hp: card.hp || null,
    types: card.types || [],
    evolves_from: card.evolvesFrom || null,
    evolves_to: card.evolvesTo || [],
    attacks: card.attacks || [],
    abilities: card.abilities || [],
    weaknesses: card.weaknesses || [],
    resistances: card.resistances || [],
    retreat_cost: card.retreatCost?.length || 0,
    rules: card.rules || []
  };

  // === Légalités ===
  const legalFormats = card.legalities || {};

  // === Carte normalisée ===
  return {
    id: card.id,
    source: 'tcg_pokemon',
    collection: 'Pokémon TCG',
    name: card.name,
    name_original: card.name, // Pokémon TCG est toujours en anglais
    
    description,
    flavor_text: flavorText,
    url: `https://pokemontcg.io/card/${card.id}`,
    
    images,
    
    barcode: null, // TCG n'ont pas de code-barres
    release_date: card.set?.releaseDate || null,
    year,
    
    set: {
      id: card.set?.id || null,
      name: card.set?.name || null,
      code: card.set?.series || null,
      series: card.set?.series || null,
      total_cards: setTotal,
      release_date: card.set?.releaseDate || null,
      logo: card.set?.images?.logo || null
    },
    
    card_number: card.number ? `${card.number}/${setTotal || 0}` : null,
    rarity: card.rarity || null,
    rarity_original: card.rarity || null,
    
    type: card.supertype || null,
    subtypes: card.subtypes || [],
    
    attributes,
    
    prices,
    
    legal_formats: legalFormats,
    
    artist: card.artist || null,
    
    variants: [], // TODO: gérer les variants si nécessaire
    
    external_links: {
      tcgplayer: card.tcgplayer?.url || null,
      cardmarket: card.cardmarket?.url || null,
      official: `https://www.pokemon.com/us/pokemon-tcg/pokemon-cards/${card.id}/`
    }
  };
}

/**
 * Normalise les sets Pokémon TCG
 * @param {object} rawData - Données brutes des sets
 * @param {object} options - Options { lang }
 * @returns {object} - Sets normalisés
 */
export function normalizePokemonSets(rawData, options = {}) {
  const { lang = 'fr' } = options;

  if (!rawData || !rawData.data) {
    return {
      total: 0,
      sets: []
    };
  }

  const sets = rawData.data.map(set => ({
    id: set.id,
    source: 'pokemon-tcg',
    name: set.name,
    code: set.series || null,
    series: set.series || null,
    total_cards: set.total || null,
    printed_total: set.printedTotal || null,
    release_date: set.releaseDate || null,
    year: set.releaseDate ? parseInt(set.releaseDate.split('-')[0]) : null,
    images: {
      symbol: set.images?.symbol || null,
      logo: set.images?.logo || null
    },
    detailUrl: `/tcg_pokemon/search?set=${set.id}&lang=${lang}`
  }));

  return {
    total: sets.length,
    sets
  };
}

// ============================================================================
// MAGIC: THE GATHERING (SCRYFALL)
// ============================================================================

/**
 * Normalise les résultats de recherche Magic: The Gathering
 * @param {object} rawData - Données brutes de l'API Scryfall
 * @param {object} options - Options { lang, autoTrad }
 * @returns {Promise<object>} - Résultats normalisés
 */
export async function normalizeMTGSearch(rawData, options = {}) {
  const { lang = 'en', autoTrad = false } = options;
  
  if (!rawData || !rawData.data) {
    return { total: 0, data: [] };
  }
  
  const cards = await Promise.all(rawData.data.map(async (card) => {
    // Image principale (préférence pour image normale, sinon small)
    const thumbnail = card.image_uris?.normal || card.image_uris?.small || 
                     card.card_faces?.[0]?.image_uris?.normal || '';
    
    // Nom (localisé si disponible)
    const name = card.printed_name || card.name;
    
    // Description courte pour la recherche
    let description = card.type_line || '';
    if (card.oracle_text) {
      const shortText = card.oracle_text.substring(0, 150);
      description += ` - ${shortText}${card.oracle_text.length > 150 ? '...' : ''}`;
    }
    
    // Traduire si demandé
    if (autoTrad && lang !== 'en') {
      description = await translateText(description, { from: 'en', to: lang });
    }
    
    return {
      id: card.id,
      source: 'tcg_mtg',
      collection: 'Magic: The Gathering',
      name,
      description,
      image: thumbnail,
      detailUrl: `/tcg_mtg/card?id=${card.id}`,
      set: card.set_name || '',
      set_code: card.set || '',
      rarity: card.rarity || '',
      colors: card.colors || [],
      mana_cost: card.mana_cost || '',
      cmc: card.cmc || 0,
      type: card.type_line || '',
      prices: {
        usd: card.prices?.usd || null,
        eur: card.prices?.eur || null,
        tix: card.prices?.tix || null
      }
    };
  }));
  
  return {
    total: rawData.total_cards || cards.length,
    has_more: rawData.has_more || false,
    data: cards
  };
}

/**
 * Normalise les détails d'une carte Magic: The Gathering
 * @param {object} rawCard - Données brutes d'une carte Scryfall
 * @param {object} options - Options { lang, autoTrad }
 * @returns {Promise<object>} - Carte normalisée
 */
export async function normalizeMTGCard(rawCard, options = {}) {
  const { lang = 'en', autoTrad = false } = options;
  
  if (!rawCard) {
    return null;
  }
  
  // Gestion des cartes double-face
  const isDoubleFaced = rawCard.card_faces && rawCard.card_faces.length > 0;
  
  // Images
  let images = [];
  if (rawCard.image_uris) {
    images.push({
      type: 'normal',
      url: rawCard.image_uris.normal || rawCard.image_uris.large,
      small: rawCard.image_uris.small
    });
  } else if (isDoubleFaced) {
    rawCard.card_faces.forEach((face, index) => {
      if (face.image_uris) {
        images.push({
          type: `face_${index}`,
          url: face.image_uris.normal || face.image_uris.large,
          small: face.image_uris.small,
          name: face.name
        });
      }
    });
  }
  
  // Texte oracle (règles)
  let oracle_text = rawCard.oracle_text || '';
  let flavor_text = rawCard.flavor_text || '';
  
  // Pour les cartes double-face, combiner les textes
  if (isDoubleFaced && !oracle_text) {
    oracle_text = rawCard.card_faces.map(face => 
      `**${face.name}**\n${face.oracle_text || ''}`
    ).join('\n\n');
    
    flavor_text = rawCard.card_faces
      .filter(face => face.flavor_text)
      .map(face => face.flavor_text)
      .join('\n\n');
  }
  
  // Traduction si demandée
  if (autoTrad && lang !== 'en') {
    oracle_text = await translateText(oracle_text, { from: 'en', to: lang });
    if (flavor_text) {
      flavor_text = await translateText(flavor_text, { from: 'en', to: lang });
    }
  }
  
  // Description combinée
  let description = `**${rawCard.type_line}**\n\n`;
  if (rawCard.mana_cost) description += `Coût: ${rawCard.mana_cost}\n\n`;
  if (oracle_text) description += `${oracle_text}\n\n`;
  if (flavor_text) description += `*${flavor_text}*\n\n`;
  if (rawCard.power && rawCard.toughness) {
    description += `Force/Endurance: ${rawCard.power}/${rawCard.toughness}\n\n`;
  }
  
  // Attributs spécifiques Magic
  const attributes = {
    mana_cost: rawCard.mana_cost || '',
    cmc: rawCard.cmc || 0,
    type_line: rawCard.type_line || '',
    oracle_text,
    flavor_text,
    flavor_name: rawCard.flavor_name || null, // Nom du personnage (Universes Beyond, collaborations)
    colors: rawCard.colors || [],
    color_identity: rawCard.color_identity || [],
    keywords: rawCard.keywords || [],
    power: rawCard.power || null,
    toughness: rawCard.toughness || null,
    loyalty: rawCard.loyalty || null,
    artist: rawCard.artist || '',
    collector_number: rawCard.collector_number || '',
    rarity: rawCard.rarity || '',
    is_double_faced: isDoubleFaced,
    card_faces: isDoubleFaced ? rawCard.card_faces.map(face => ({
      name: face.name,
      mana_cost: face.mana_cost,
      type_line: face.type_line,
      oracle_text: face.oracle_text,
      power: face.power,
      toughness: face.toughness,
      colors: face.colors
    })) : null
  };
  
  // Prix
  const prices = {
    usd: rawCard.prices?.usd || null,
    usd_foil: rawCard.prices?.usd_foil || null,
    eur: rawCard.prices?.eur || null,
    eur_foil: rawCard.prices?.eur_foil || null,
    tix: rawCard.prices?.tix || null
  };
  
  // Légalité dans les formats
  const legal_formats = {};
  if (rawCard.legalities) {
    Object.entries(rawCard.legalities).forEach(([format, status]) => {
      if (status === 'legal' || status === 'restricted') {
        legal_formats[format] = status;
      }
    });
  }
  
  return {
    id: rawCard.id,
    source: 'tcg_mtg',
    collection: 'Magic: The Gathering',
    name: rawCard.printed_name || rawCard.name,
    description,
    images,
    attributes,
    prices,
    legal_formats,
    set: {
      name: rawCard.set_name,
      code: rawCard.set,
      type: rawCard.set_type,
      released_at: rawCard.released_at
    },
    purchase_urls: {
      tcgplayer: rawCard.purchase_uris?.tcgplayer || null,
      cardmarket: rawCard.purchase_uris?.cardmarket || null,
      cardhoarder: rawCard.purchase_uris?.cardhoarder || null
    },
    related_uris: {
      gatherer: rawCard.related_uris?.gatherer || null,
      edhrec: rawCard.related_uris?.edhrec || null,
      scryfall: rawCard.scryfall_uri || null
    }
  };
}

/**
 * Normalise la liste des sets Magic: The Gathering
 * @param {object} rawData - Données brutes des sets Scryfall
 * @returns {object} - Sets normalisés
 */
export function normalizeMTGSets(rawData) {
  if (!rawData || !rawData.data) {
    return { total: 0, sets: [] };
  }
  
  const sets = rawData.data.map(set => ({
    id: set.id,
    code: set.code,
    name: set.name,
    type: set.set_type,
    released_at: set.released_at,
    card_count: set.card_count || 0,
    digital: set.digital || false,
    icon_svg_uri: set.icon_svg_uri || null,
    search_uri: set.search_uri || null,
    scryfall_uri: set.scryfall_uri || null
  }));
  
  return {
    total: sets.length,
    sets
  };
}

// ============================================================================
// YU-GI-OH! (YGOPRODECK)
// ============================================================================

/**
 * Normalise les résultats de recherche Yu-Gi-Oh!
 * @param {object} rawData - Données brutes de l'API YGOPRODeck
 * @param {object} options - Options { lang, autoTrad }
 * @returns {Promise<object>} - Résultats normalisés
 */
export async function normalizeYuGiOhSearch(rawData, options = {}) {
  const { lang = 'en', autoTrad = false } = options;
  
  if (!rawData || !rawData.data) {
    return { total: 0, data: [] };
  }
  
  const cards = await Promise.all(rawData.data.map(async (card) => {
    // Image principale
    const thumbnail = card.card_images?.[0]?.image_url_small || card.card_images?.[0]?.image_url || '';
    
    // Description de la carte
    let description = card.desc || '';
    
    // Pour les monstres, ajouter ATK/DEF
    if (card.atk !== undefined) {
      description = `[${card.type}] ATK/${card.atk} DEF/${card.def || '?'}\n\n${description}`;
    }
    
    // Traduire si demandé
    if (autoTrad && lang !== 'en' && description) {
      description = await translateText(description, { from: 'en', to: lang });
    }
    
    return {
      id: card.id,
      source: 'tcg_yugioh',
      collection: 'Yu-Gi-Oh!',
      name: card.name,
      description,
      image: thumbnail,
      detailUrl: `/tcg_yugioh/card?id=${card.id}${lang && lang !== 'en' ? `&lang=${lang}` : ''}`,
      type: card.type || '',
      race: card.race || '',
      attribute: card.attribute || null,
      level: card.level || null,
      atk: card.atk !== undefined ? card.atk : null,
      def: card.def !== undefined ? card.def : null,
      archetype: card.archetype || null
    };
  }));
  
  return {
    total: rawData.total_cards || cards.length,
    data: cards
  };
}

/**
 * Normalise les détails d'une carte Yu-Gi-Oh!
 * @param {object} rawCard - Données brutes d'une carte YGOPRODeck
 * @param {object} options - Options { lang, autoTrad }
 * @returns {Promise<object>} - Carte normalisée
 */
export async function normalizeYuGiOhCard(rawCard, options = {}) {
  const { lang = 'en', autoTrad = false } = options;
  
  if (!rawCard) {
    return null;
  }
  
  // Images (toutes les variantes)
  const images = (rawCard.card_images || []).map((img, index) => ({
    type: index === 0 ? 'default' : `variant_${img.id}`,
    url: img.image_url || '',
    small: img.image_url_small || '',
    crop: img.image_url_cropped || ''
  }));
  
  // Description
  let description = rawCard.desc || '';
  
  // Traduction si demandée
  if (autoTrad && lang !== 'en' && description) {
    description = await translateText(description, { from: 'en', to: lang });
  }
  
  // Construire la description formatée
  let formattedDescription = `**${rawCard.type}**\n\n`;
  
  if (rawCard.race) {
    formattedDescription += `Race: ${rawCard.race}\n`;
  }
  
  if (rawCard.attribute) {
    formattedDescription += `Attribute: ${rawCard.attribute}\n`;
  }
  
  if (rawCard.level) {
    formattedDescription += `Level: ${rawCard.level}\n`;
  }
  
  if (rawCard.atk !== undefined) {
    formattedDescription += `ATK: ${rawCard.atk} / DEF: ${rawCard.def || '?'}\n`;
  }
  
  formattedDescription += `\n${description}`;
  
  // Attributs spécifiques Yu-Gi-Oh!
  const attributes = {
    type: rawCard.type || '',
    race: rawCard.race || '',
    attribute: rawCard.attribute || null,
    level: rawCard.level || null,
    atk: rawCard.atk !== undefined ? rawCard.atk : null,
    def: rawCard.def !== undefined ? rawCard.def : null,
    scale: rawCard.scale || null,
    linkval: rawCard.linkval || null,
    linkmarkers: rawCard.linkmarkers || null,
    archetype: rawCard.archetype || null,
    typeline: rawCard.typeline || []
  };
  
  // Sets dans lesquels la carte apparaît
  const card_sets = (rawCard.card_sets || []).map(set => ({
    name: set.set_name,
    code: set.set_code,
    rarity: set.set_rarity,
    rarity_code: set.set_rarity_code,
    price: set.set_price
  }));
  
  // Prix (moyenne des sets)
  const prices = {
    cardmarket: rawCard.card_prices?.[0]?.cardmarket_price || null,
    tcgplayer: rawCard.card_prices?.[0]?.tcgplayer_price || null,
    ebay: rawCard.card_prices?.[0]?.ebay_price || null,
    amazon: rawCard.card_prices?.[0]?.amazon_price || null,
    coolstuffinc: rawCard.card_prices?.[0]?.coolstuffinc_price || null
  };
  
  // Banlist info
  const banlist_info = rawCard.banlist_info || null;
  
  return {
    id: rawCard.id,
    source: 'tcg_yugioh',
    collection: 'Yu-Gi-Oh!',
    name: rawCard.name,
    description: formattedDescription,
    images,
    attributes,
    card_sets,
    prices,
    banlist_info,
    misc_info: rawCard.misc_info || []
  };
}

/**
 * Normalise la liste des sets Yu-Gi-Oh!
 * @param {array} rawSets - Données brutes des sets YGOPRODeck
 * @returns {object} - Sets normalisés
 */
export function normalizeYuGiOhSets(rawSets) {
  if (!rawSets || !Array.isArray(rawSets)) {
    return { total: 0, sets: [] };
  }
  
  const sets = rawSets.map(set => ({
    name: set.set_name || set,
    code: set.set_code || null,
    total_cards: set.num_of_cards || null,
    release_date: set.tcg_date || null
  }));
  
  return {
    total: sets.length,
    sets
  };
}

// ============================================================================
// DISNEY LORCANA
// ============================================================================

/**
 * Normalise les résultats de recherche Lorcana

// ============================================================================
// DISNEY LORCANA
// ============================================================================

/**
 * Normalise les résultats de recherche Lorcana (LorcanaJSON)
 * @param {object} rawData - Données brutes de LorcanaJSON { total_cards, page, data: [...] }
 * @param {object} options - Options { lang }
 * @returns {Promise<object>} - Résultats normalisés
 */
export async function normalizeLorcanaSearch(rawData, options = {}) {
  const { lang = 'en' } = options;
  
  // LorcanaJSON renvoie { total_cards, page, data: [...] }
  const cards = rawData?.data || rawData;
  
  if (!Array.isArray(cards)) {
    return { total: 0, data: [] };
  }
  
  const normalized = cards.map((card) => {
    // LorcanaJSON a déjà les traductions natives
    const thumbnail = card.images?.thumbnail || card.images?.full || null;
    const fullImage = card.images?.full || thumbnail;
    
    // Construire la description à partir des abilities
    let description = '';
    
    // Ajouter les abilities
    if (card.abilities && card.abilities.length > 0) {
      card.abilities.forEach(ability => {
        if (ability.name) {
          description += `**${ability.name}**: ${ability.fullText || ability.text || ''}\n\n`;
        } else {
          description += `${ability.fullText || ability.text || ''}\n\n`;
        }
      });
    } else if (card.fullText) {
      description = card.fullText;
    }
    
    // Ajouter le flavor text
    if (card.flavourText) {
      description += `\n*${card.flavourText}*`;
    }
    
    // Ajouter les stats pour les personnages
    if (card.type === 'Character' || card.type === 'Personnage') {
      const stats = [];
      if (card.strength !== undefined) stats.push(`STR: ${card.strength}`);
      if (card.willpower !== undefined) stats.push(`WIL: ${card.willpower}`);
      if (card.loreValue !== undefined) stats.push(`LORE: ${card.loreValue}`);
      if (stats.length > 0) {
        description = `[${card.color}] ${stats.join(' | ')}\n\n${description}`;
      }
    }
    
    return {
      id: card.id || card.code,
      source: 'tcg_lorcana',
      collection: 'Disney Lorcana',
      name: card.fullName || card.name,
      name_original: card.fullName || card.name,
      description: description.trim(),
      image: thumbnail,
      image: fullImage,
      detailUrl: `/tcg_lorcana/card?id=${card.id || card.code}`,
      type: card.type || '',
      color: card.color || '',
      cost: card.cost !== undefined ? card.cost : null,
      inkable: card.inkwell || false,
      rarity: card.rarity || '',
      set_name: card.setName || '',
      set_num: card.setNum || card.setNumber || null,
      card_num: card.collectorNumber || card.number || null,
      strength: card.strength !== undefined ? card.strength : null,
      willpower: card.willpower !== undefined ? card.willpower : null,
      lore: card.loreValue !== undefined ? card.loreValue : null,
      // Nouveaux champs LorcanaJSON
      external_links: card.externalLinks || {},
      formats: card.allowedInFormats || []
    };
  });
  
  return {
    total: normalized.length,
    data: normalized
  };
}

/**
 * Normalise les détails d'une carte Lorcana (LorcanaJSON)
 * @param {object} rawCard - Données brutes d'une carte Lorcana
 * @param {object} options - Options { lang }
 * @returns {Promise<object>} - Carte normalisée
 */
export async function normalizeLorcanaCard(rawCard, options = {}) {
  const { lang = 'en' } = options;
  
  if (!rawCard) {
    return null;
  }
  
  // Images
  const images = [];
  if (rawCard.images?.full) {
    images.push({
      type: 'full',
      url: rawCard.images.full,
      small: rawCard.images.thumbnail || rawCard.images.full
    });
  }
  if (rawCard.images?.thumbnail) {
    images.push({
      type: 'thumbnail',
      url: rawCard.images.thumbnail,
      small: rawCard.images.thumbnail
    });
  }
  
  // Description formatée
  let formattedDescription = `**${rawCard.type} - ${rawCard.color}**\n\n`;
  
  if (rawCard.cost !== undefined) {
    formattedDescription += `Cost: ${rawCard.cost} | Inkable: ${rawCard.inkwell ? 'Yes' : 'No'}\n`;
  }
  
  if (rawCard.type === 'Character' || rawCard.type === 'Personnage') {
    formattedDescription += `Strength: ${rawCard.strength} | Willpower: ${rawCard.willpower} | Lore: ${rawCard.loreValue || 0}\n`;
  }
  
  // Abilities
  if (rawCard.abilities && rawCard.abilities.length > 0) {
    formattedDescription += '\n';
    rawCard.abilities.forEach(ability => {
      if (ability.name) {
        formattedDescription += `**${ability.name}**: ${ability.fullText || ability.text || ''}\n\n`;
      } else {
        formattedDescription += `${ability.fullText || ability.text || ''}\n\n`;
      }
    });
  } else if (rawCard.fullText) {
    formattedDescription += `\n${rawCard.fullText}\n\n`;
  }
  
  // Flavor text
  if (rawCard.flavourText) {
    formattedDescription += `\n*${rawCard.flavourText}*`;
  }
  
  const attributes = {
    type: rawCard.type || '',
    color: rawCard.color || '',
    cost: rawCard.cost !== undefined ? rawCard.cost : null,
    inkable: rawCard.inkwell || false,
    strength: rawCard.strength !== undefined ? rawCard.strength : null,
    willpower: rawCard.willpower !== undefined ? rawCard.willpower : null,
    lore: rawCard.loreValue !== undefined ? rawCard.loreValue : null,
    rarity: rawCard.rarity || '',
    franchise: rawCard.franchise || '',
    classifications: rawCard.classifications || [],
    artist: rawCard.artistsText || rawCard.artists?.[0]?.name || '',
    formats: rawCard.allowedInFormats || []
  };
  
  return {
    id: rawCard.id || rawCard.code,
    source: 'tcg_lorcana',
    collection: 'Disney Lorcana',
    name: rawCard.fullName || rawCard.name,
    description: formattedDescription,
    images,
    attributes,
    set: {
      name: rawCard.setName,
      id: rawCard.setId,
      number: rawCard.setNum || rawCard.setNumber,
      card_number: rawCard.collectorNumber || rawCard.number
    },
    external_links: rawCard.externalLinks || {},
    date_added: rawCard.dateAdded || null,
    date_modified: rawCard.dateModified || null
  };
}

/**
 * Normalise la liste des sets Lorcana (LorcanaJSON)
 * @param {object|array} rawSets - Données brutes des sets Lorcana (objet ou tableau)
 * @returns {object} - Sets normalisés
 */
export function normalizeLorcanaSets(rawSets) {
  if (!rawSets) {
    return { total: 0, sets: [] };
  }
  
  // LorcanaJSON renvoie un objet { "1": {...}, "2": {...} }
  let setsArray = [];
  if (Array.isArray(rawSets)) {
    setsArray = rawSets;
  } else if (typeof rawSets === 'object') {
    setsArray = Object.entries(rawSets).map(([key, set]) => ({
      ...set,
      id: set.id || set.setId || key,
      code: set.code || set.setCode || key
    }));
  }
  
  const sets = setsArray.map(set => ({
    id: set.id || set.setId || set.number,
    name: set.name || set.setName,
    code: set.code || set.setCode,
    release_date: set.releaseDate || null,
    total_cards: set.cardCount || set.total || null,
    type: set.type || null,
    formats: set.allowedInFormats || {}
  }));
  
  return {
    total: sets.length,
    sets
  };
}

// ============================================================================
// DIGIMON CARD GAME
// ============================================================================

/**
 * Normalise les résultats de recherche Digimon
 * @param {array} rawData - Données brutes de l'API Digimon
 * @param {object} options - Options { lang, autoTrad }
 * @returns {Promise<object>} - Résultats normalisés
 */
export async function normalizeDigimonSearch(rawData, options = {}) {
  const { lang = 'en', autoTrad = false, max } = options;
  
  if (!rawData || !Array.isArray(rawData)) {
    return { total: 0, data: [] };
  }
  
  // Dédupliquer par ID (l'API source retourne des doublons pour les variantes)
  const uniqueCards = [];
  const seenIds = new Set();
  
  for (const card of rawData) {
    if (!seenIds.has(card.id)) {
      seenIds.add(card.id);
      uniqueCards.push(card);
      // Limiter après déduplication si max est spécifié
      if (max && uniqueCards.length >= max) {
        break;
      }
    }
  }
  
  const cards = await Promise.all(uniqueCards.map(async (card) => {
    const thumbnail = `https://images.digimoncard.io/images/cards/${card.id.replace(/_/g, '-')}.jpg`;
    const baseUrl = process.env.API_BASE_URL || `http://${process.env.IP_HOST || '10.110.1.1'}:3000`;
    
    let description = '';
    
    // Info de base pour Digimon
    if (card.type === 'Digimon') {
      const parts = [];
      if (card.level) parts.push(`Lv.${card.level}`);
      if (card.dp) parts.push(`DP ${card.dp}`);
      if (card.play_cost) parts.push(`Play Cost ${card.play_cost}`);
      if (card.evolution_cost && card.evolution_level) {
        parts.push(`Evo ${card.evolution_cost} from Lv.${card.evolution_level}`);
      }
      description = parts.join(' | ');
    } else if (card.type === 'Tamer' || card.type === 'Option') {
      description = `${card.type}`;
      if (card.play_cost) description += ` | Cost ${card.play_cost}`;
    }
    
    // Effets
    if (card.main_effect) {
      description += `\n\n${card.main_effect}`;
    }
    if (card.source_effect) {
      description += `\n\n[Security] ${card.source_effect}`;
    }
    
    // Traduction si demandée
    if (autoTrad && lang !== 'en' && description) {
      description = await translateText(description, { from: 'en', to: lang });
    }
    
    return {
      id: card.id,
      source: 'tcg_digimon',
      collection: 'Digimon Card Game',
      name: card.name,
      description,
      image: `${baseUrl}/proxy/image?url=${encodeURIComponent(thumbnail)}`,
      originalImage: thumbnail,
      detailUrl: `/tcg_digimon/card?id=${card.id}`,
      type: card.type || '',
      color: card.color || '',
      color2: card.color2 || null,
      level: card.level || null,
      play_cost: card.play_cost || null,
      dp: card.dp || null,
      rarity: card.rarity || '',
      attribute: card.attribute || '',
      stage: card.stage || '',
      form: card.form || '',
      digi_type: card.digi_type || '',
      set_name: Array.isArray(card.set_name) ? card.set_name[0] : card.set_name
    };
  }));
  
  return {
    total: cards.length,
    data: cards
  };
}

/**
 * Normalise les détails d'une carte Digimon
 * @param {object} rawCard - Données brutes d'une carte Digimon
 * @param {object} options - Options { lang, autoTrad }
 * @returns {Promise<object>} - Carte normalisée
 */
export async function normalizeDigimonCard(rawCard, options = {}) {
  const { lang = 'en', autoTrad = false } = options;
  
  if (!rawCard) {
    return null;
  }
  
  const baseUrl = process.env.API_BASE_URL || `http://${process.env.IP_HOST || '10.110.1.1'}:3000`;
  const imageUrl = `https://images.digimoncard.io/images/cards/${rawCard.id.replace(/_/g, '-')}.jpg`;
  const images = [{
    type: 'default',
    url: `${baseUrl}/proxy/image?url=${encodeURIComponent(imageUrl)}`,
    originalUrl: imageUrl
  }];
  
  // Effets
  let main_effect = rawCard.main_effect || '';
  let source_effect = rawCard.source_effect || '';
  let alt_effect = rawCard.alt_effect || '';
  
  // Traduction si demandée
  if (autoTrad && lang !== 'en') {
    if (main_effect) {
      main_effect = await translateText(main_effect, { from: 'en', to: lang });
    }
    if (source_effect) {
      source_effect = await translateText(source_effect, { from: 'en', to: lang });
    }
    if (alt_effect) {
      alt_effect = await translateText(alt_effect, { from: 'en', to: lang });
    }
  }
  
  // Construire la description formatée
  let formattedDescription = `**${rawCard.type}**`;
  
  if (rawCard.color) {
    formattedDescription += ` - ${rawCard.color}`;
    if (rawCard.color2) formattedDescription += `/${rawCard.color2}`;
  }
  
  formattedDescription += '\n\n';
  
  if (rawCard.type === 'Digimon') {
    const stats = [];
    if (rawCard.level) stats.push(`Level: ${rawCard.level}`);
    if (rawCard.dp) stats.push(`DP: ${rawCard.dp}`);
    if (rawCard.play_cost !== null) stats.push(`Play Cost: ${rawCard.play_cost}`);
    if (rawCard.evolution_cost && rawCard.evolution_level) {
      stats.push(`Evolution: Cost ${rawCard.evolution_cost} from Lv.${rawCard.evolution_level} ${rawCard.evolution_color || ''}`);
    }
    formattedDescription += stats.join(' | ') + '\n';
  } else if (rawCard.play_cost !== null) {
    formattedDescription += `Cost: ${rawCard.play_cost}\n`;
  }
  
  if (main_effect) {
    formattedDescription += `\n${main_effect}`;
  }
  
  if (source_effect) {
    formattedDescription += `\n\n**[Security]** ${source_effect}`;
  }
  
  if (alt_effect) {
    formattedDescription += `\n\n**[Alt Effect]** ${alt_effect}`;
  }
  
  // Attributs spécifiques Digimon
  const attributes = {
    type: rawCard.type || '',
    color: rawCard.color || '',
    color2: rawCard.color2 || null,
    level: rawCard.level || null,
    play_cost: rawCard.play_cost !== null ? rawCard.play_cost : null,
    evolution_cost: rawCard.evolution_cost || null,
    evolution_level: rawCard.evolution_level || null,
    evolution_color: rawCard.evolution_color || null,
    xros_req: rawCard.xros_req || null,
    dp: rawCard.dp || null,
    attribute: rawCard.attribute || '',
    stage: rawCard.stage || '',
    form: rawCard.form || '',
    digi_types: [
      rawCard.digi_type,
      rawCard.digi_type2,
      rawCard.digi_type3,
      rawCard.digi_type4
    ].filter(Boolean),
    rarity: rawCard.rarity || '',
    artist: rawCard.artist || null
  };
  
  return {
    id: rawCard.id,
    source: 'tcg_digimon',
    collection: 'Digimon Card Game',
    name: rawCard.name,
    description: formattedDescription,
    images,
    attributes,
    set: {
      names: Array.isArray(rawCard.set_name) ? rawCard.set_name : [rawCard.set_name],
      series: rawCard.series
    },
    tcgplayer: rawCard.tcgplayer_id ? {
      id: rawCard.tcgplayer_id,
      name: rawCard.tcgplayer_name
    } : null,
    pretty_url: rawCard.pretty_url || null,
    date_added: rawCard.date_added || null
  };
}

// ============================================================================
// ONE PIECE TCG (onepiece-cardgame.dev)
// ============================================================================

/**
 * Normalise les résultats de recherche One Piece TCG
 * @param {Array} rawCards - Tableau de cartes brutes (format onepiece-cardgame.dev)
 * @param {object} options - Options { lang, autoTrad }
 * @returns {Promise<object>} - Résultats normalisés
 */
export async function normalizeOnePieceSearch(rawCards, options = {}) {
  const { lang = 'fr', autoTrad = false } = options;

  if (!rawCards || !Array.isArray(rawCards)) {
    return {
      total: 0,
      count: 0,
      results: []
    };
  }

  const results = await Promise.all(rawCards.map(async (card) => {
    // Traduire l'effet si demandé
    let effect = card.e || '';
    if (autoTrad && effect && lang !== 'en') {
      effect = await translateText(effect, { from: 'en', to: lang });
    }

    const baseUrl = process.env.API_BASE_URL || `http://${process.env.IP_HOST || '10.110.1.1'}:3000`;
    return {
      id: card.cid,
      source: 'tcg_onepiece',
      collection: 'One Piece Card Game',
      name: card.n,
      image: card.iu ? `${baseUrl}/proxy/image?url=${encodeURIComponent(card.iu)}` : null,
      originalImage: card.iu || null,
      set: {
        id: extractSetCode(card.cid),
        name: card.srcN || card.set_info?.name || null,
        code: extractSetCode(card.cid)
      },
      card_number: extractCardNumber(card.cid),
      rarity: card.rarity_name || 'Unknown',
      type: card.type_name || 'Unknown',
      color: card.color_name || 'Unknown',
      cost: card.cs !== null && card.cs !== undefined ? parseInt(card.cs) : null,
      power: card.p || null,
      year: card.srcD ? parseInt(card.srcD.split('-')[0]) : null,
      description: effect,
      detailUrl: `/tcg_onepiece/card?id=${card.cid}&lang=${lang}`
    };
  }));

  return {
    total: results.length,
    count: results.length,
    results
  };
}

/**
 * Normalise une carte One Piece TCG complète
 * @param {object} rawCard - Carte brute (format onepiece-cardgame.dev)
 * @param {object} options - Options { lang, autoTrad }
 * @returns {Promise<object>} - Carte normalisée
 */
export async function normalizeOnePieceCard(rawCard, options = {}) {
  const { lang = 'fr', autoTrad = false } = options;

  if (!rawCard) {
    return null;
  }

  // Traduire l'effet si demandé
  let effect = rawCard.e || '';
  if (autoTrad && effect && lang !== 'en') {
    effect = await translateText(effect, { from: 'en', to: lang });
  }

  // Images
  const baseUrl = process.env.API_BASE_URL || `http://${process.env.IP_HOST || '10.110.1.1'}:3000`;
  const images = [
    {
      type: 'full',
      url: rawCard.iu ? `${baseUrl}/proxy/image?url=${encodeURIComponent(rawCard.iu)}` : null,
      originalUrl: rawCard.iu || null
    }
  ];

  // Construction de la description formatée
  let formattedDescription = '';
  
  // Stats principales
  const stats = [];
  if (rawCard.cs !== null && rawCard.cs !== undefined) stats.push(`Cost: ${rawCard.cs}`);
  if (rawCard.p) stats.push(`Power: ${rawCard.p}`);
  if (rawCard.cp) stats.push(`Counter: ${rawCard.cp}`);
  if (rawCard.l) stats.push(`Life: ${rawCard.l}`);
  
  if (stats.length > 0) {
    formattedDescription = stats.join(' | ');
  }
  
  // Couleur
  if (rawCard.color_name) {
    formattedDescription += `\nColor: ${rawCard.color_name}`;
  }
  
  // Traits
  if (rawCard.tr) {
    const traits = rawCard.tr.split('/').map(t => t.trim()).filter(Boolean);
    formattedDescription += `\nTraits: ${traits.join(', ')}`;
  }
  
  // Attribut (Slash, Strike, etc.)
  if (rawCard.attribute_name && rawCard.attribute_name !== 'NA') {
    formattedDescription += `\nAttribute: ${rawCard.attribute_name}`;
  }
  
  // Effet de carte
  if (effect) {
    formattedDescription += `\n\n${effect}`;
  }
  
  // Attributs spécifiques One Piece
  const attributes = {
    type: rawCard.type_name || 'Unknown',
    color: rawCard.color_name || 'Unknown',
    cost: rawCard.cs !== null && rawCard.cs !== undefined ? parseInt(rawCard.cs) : null,
    power: rawCard.p ? parseInt(rawCard.p) : null,
    counterPower: rawCard.cp ? parseInt(rawCard.cp) : null,
    life: rawCard.l ? parseInt(rawCard.l) : null,
    traits: rawCard.tr ? rawCard.tr.split('/').map(t => t.trim()).filter(Boolean) : [],
    attribute: rawCard.attribute_name || 'N/A',
    rarity: rawCard.rarity_name || 'Unknown',
    set_info: rawCard.set_info || null,
    release_date: rawCard.srcD || null
  };
  
  return {
    id: rawCard.cid,
    source: 'tcg_onepiece',
    collection: 'One Piece Card Game',
    name: rawCard.n,
    description: formattedDescription,
    images,
    attributes,
    set: {
      id: extractSetCode(rawCard.cid),
      name: rawCard.srcN || rawCard.set_info?.name || null,
      code: extractSetCode(rawCard.cid),
      release_date: rawCard.srcD || rawCard.set_info?.release_date || null
    },
    global_id: rawCard.gid || null,
    international: rawCard.intl === "1" || rawCard.intl === 1
  };
}

/**
 * Extrait le code du set depuis l'ID de carte
 * @param {string} cid - Card ID (ex: OP01-047)
 * @returns {string|null} - Set code (ex: OP-01)
 */
function extractSetCode(cid) {
  if (!cid) return null;
  
  // OP01-047 -> OP-01
  // ST01-005 -> ST-01
  const match = cid.match(/^([A-Z]+)(\d+)-/);
  if (match) {
    return `${match[1]}-${match[2].padStart(2, '0')}`;
  }
  
  return null;
}

/**
 * Extrait le numéro de carte depuis l'ID
 * @param {string} cid - Card ID (ex: OP01-047)
 * @returns {string|null} - Card number (ex: 047)
 */
function extractCardNumber(cid) {
  if (!cid) return null;
  
  const match = cid.match(/-(\d+)$/);
  return match ? match[1] : null;
}

/**
 * Normalise les résultats de recherche Carddass
 * @param {array} rawCards - Cartes brutes depuis animecollection.fr
 * @param {object} options - Options { lang }
 * @returns {array} - Cartes normalisées
 */
export function normalizeCarddassSearch(rawCards, options = {}) {
  return rawCards.map(card => ({
    id: `carddass-${card.id}`,
    source: 'carddass',
    name: `${card.license} ${card.collection} ${card.serie} #${card.number}`,
    thumbnail: card.images.thumb,
    set: `${card.collection} ${card.serie}`,
    card_number: card.number,
    rarity: card.rarity,
    type: 'Character',
    year: card.year,
    detailUrl: card.detailUrl,
    description: `${card.license} - ${card.collection} (${card.year || 'N/A'})`
  }));
}

/**
 * Normalise une carte Carddass complète
 * @param {object} rawCard - Carte brute depuis animecollection.fr
 * @param {object} options - Options { lang, autoTrad }
 * @returns {Promise<object>} - Carte normalisée
 */
export async function normalizeCarddassCard(rawCard, options = {}) {
  const { lang = 'fr', autoTrad = false } = options;
  
  let description = `Carddass ${rawCard.license}`;
  if (rawCard.serie) {
    description = `${rawCard.license} - ${rawCard.collection} ${rawCard.serie} (${rawCard.year || 'N/A'})`;
  }
  
  return {
    id: `carddass-${rawCard.id}`,
    source: 'carddass',
    name: `${rawCard.license} ${rawCard.collection} ${rawCard.serie} #${rawCard.number}`,
    thumbnail: rawCard.images.medium,
    set: {
      name: `${rawCard.collection} ${rawCard.serie}`,
      code: `${rawCard.serie}`,
      year: rawCard.year
    },
    card_number: rawCard.number,
    rarity: rawCard.rarity,
    type: 'Character',
    images: [
      { url: rawCard.images.thumb, type: 'thumbnail' },
      { url: rawCard.images.medium, type: 'normal' },
      { url: rawCard.images.large, type: 'large' }
    ],
    attributes: {
      license: rawCard.license,
      collection: rawCard.collection,
      serie: rawCard.serie,
      year: rawCard.year,
      rarity: rawCard.rarity
    },
    detailUrl: rawCard.detailUrl,
    description
  };
}

// ============================================================================
// POKEMON.COM OFFICIAL NORMALIZERS
// ============================================================================

/**
 * Normalise les résultats de recherche Pokemon.com
 * @param {object} rawData - Données brutes du scraper Pokemon.com
 * @param {object} options - Options { lang, autoTrad }
 * @returns {Promise<object>} - Résultats normalisés
 */
export async function normalizePokemonSearchOfficial(rawData, options = {}) {
  const { lang = 'fr' } = options;

  if (!rawData || !rawData.cards) {
    return {
      total: 0,
      count: 0,
      page: 1,
      totalPages: 0,
      results: []
    };
  }

  // Générer l'URL de l'image en fonction du set et du numéro
  const buildCardImageUrl = (set, number, lang) => {
    // Mapping des codes de langues
    const langMap = {
      'fr': 'fr-fr',
      'en': 'en-us',
      'de': 'de-de',
      'it': 'it-it',
      'es': 'es-es',
      'pt': 'pt-pt'
    };
    
    const langCode = langMap[lang] || 'en-us';
    const langUpperShort = langCode.split('-')[0].toUpperCase(); // FR, EN, DE, etc.
    const setUpper = set.toUpperCase();
    
    // Pattern: https://assets.pokemon.com/static-assets/content-assets/cms2-fr-fr/img/cards/web/SVP/SVP_FR_27.png
    return `https://assets.pokemon.com/static-assets/content-assets/cms2-${langCode}/img/cards/web/${setUpper}/${setUpper}_${langUpperShort}_${number}.png`;
  };

  // Les résultats de recherche contiennent juste set/number/url - on génère l'image
  const results = rawData.cards.map(card => {
    return {
      type: 'Pokémon',
      source: 'tcg_pokemon',
      sourceId: `${card.set}-${card.number}`,
      name: card.name || null, // Extrait depuis l'attribut alt de l'image
      name_original: null,
      image: buildCardImageUrl(card.set, card.number, lang),
      detailUrl: `/tcg_pokemon/card?id=${card.set}-${card.number}&lang=${lang}`,
      description: null,
      year: null,
      src_url: card.url
    };
  });

  return {
    total: rawData.count || results.length,
    count: results.length,
    page: 1,
    totalPages: 1,
    results
  };
}

/**
 * Normalise une carte Pokemon.com
 * @param {object} rawCard - Données brutes scrapées de Pokemon.com
 * @param {object} options - Options { lang, autoTrad }
 * @returns {Promise<object>} - Carte normalisée (format unifié TCG)
 */
export async function normalizePokemonCardOfficial(rawCard, options = {}) {
  const { lang = 'fr', autoTrad = false } = options;

  if (!rawCard) return null;

  // === Description (format similaire à Digimon) ===
  let description = '';
  
  // HP
  if (rawCard.hp) {
    description += `HP${rawCard.hp}`;
  }
  
  // Type de carte
  if (rawCard.cardType) {
    description += description ? ` |${rawCard.cardType}` : rawCard.cardType;
  }
  
  // Attaques
  if (rawCard.attacks && rawCard.attacks.length > 0) {
    const attacksText = rawCard.attacks.map(a => {
      const damage = a.damage ? ` [${a.damage}]` : '';
      const text = a.text ? `: ${a.text}` : '';
      return `\n\n**${a.name}**${damage}${text}`;
    }).join('');
    description += attacksText;
  }
  
  // Faiblesse/Résistance
  if (rawCard.weakness) {
    description += `\n\nFaiblesse: ${rawCard.weakness.type} ${rawCard.weakness.value}`;
  }
  if (rawCard.resistance) {
    description += `\n\nRésistance: ${rawCard.resistance.type} ${rawCard.resistance.value}`;
  }
  
  // Coût de retraite
  if (rawCard.retreatCost) {
    description += `\n\nRetraite: ${rawCard.retreatCost}`;
  }

  return {
    type: 'Pokémon',
    source: 'tcg_pokemon',
    sourceId: `${rawCard.set}-${rawCard.number}`,
    name: rawCard.name || null,
    name_original: null,
    image: rawCard.imageUrl || null,
    detailUrl: `/tcg_pokemon/card?id=${rawCard.set}-${rawCard.number}&lang=${lang}`,
    description: description.trim() || null,
    year: null,
    src_url: rawCard.url || null
  };
}
