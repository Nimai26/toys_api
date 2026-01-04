/**
 * Provider Carddass - Scraping animecollection.fr
 * Source: http://www.animecollection.fr/
 * 
 * Database: 30,178 cartes, 80 licences, 335 collections, 713 séries
 */

import * as cheerio from 'cheerio';
import { fetchViaProxy } from '../../utils/fetch-proxy.js';

const ANIMECOLLECTION_BASE = 'http://www.animecollection.fr';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h (données vintage)

class CarddassProvider {
  constructor() {
    this.baseUrl = ANIMECOLLECTION_BASE;
    this.cache = new Map();
    this.circuitBreakerState = 'closed';
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.cooldownPeriod = 15 * 60 * 1000; // 15 min
    this.failureThreshold = 3;
  }

  /**
   * Récupère toutes les licences Carddass
   * Parse: http://www.animecollection.fr/cartes.php
   */
  async getAllLicenses() {
    const cacheKey = 'licenses_all';
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
      }
    }

    const url = `${this.baseUrl}/cartes.php`;
    const html = await this._fetchWithCircuitBreaker(url);
    const $ = cheerio.load(html);
    
    const licenses = [];
    const seen = new Set();
    
    // Parser les images de licences avec leur lien
    $('a[href*="cartes.php?idl="] img').each((i, el) => {
      const $img = $(el);
      const $link = $img.parent('a');
      const href = $link.attr('href');
      
      if (href) {
        const match = href.match(/idl=(\d+)/);
        const licenseName = $img.attr('id') || $link.next('.bloc_texte_licence').text().trim();
        
        if (match && licenseName && !seen.has(match[1])) {
          seen.add(match[1]);
          licenses.push({
            id: parseInt(match[1]),
            name: licenseName.trim()
          });
        }
      }
    });
    
    // Trier par nom
    licenses.sort((a, b) => a.name.localeCompare(b.name));
    
    this.cache.set(cacheKey, {
      data: licenses,
      timestamp: Date.now()
    });
    
    return licenses;
  }

  /**
   * Récupère les collections d'une licence
   * Parse: http://www.animecollection.fr/cartes.php?idl=56
   */
  async getCollectionsByLicense(licenseId) {
    const cacheKey = `collections_${licenseId}`;
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
      }
    }

    const url = `${this.baseUrl}/cartes.php?idl=${licenseId}`;
    const html = await this._fetchWithCircuitBreaker(url);
    const $ = cheerio.load(html);
    
    const collections = [];
    const seen = new Set();
    
    // Parser les liens de collections dans le menu latéral
    $('a[href*="idc="]').each((i, el) => {
      const href = $(el).attr('href');
      const match = href.match(/idc=(\d+)/);
      if (match && !seen.has(match[1])) {
        seen.add(match[1]);
        collections.push({
          id: parseInt(match[1]),
          licenseId: parseInt(licenseId),
          name: $(el).text().trim()
        });
      }
    });
    
    this.cache.set(cacheKey, {
      data: collections,
      timestamp: Date.now()
    });
    
    return collections;
  }

  /**
   * Récupère les séries d'une collection
   */
  async getSeriesByCollection(licenseId, collectionId) {
    const cacheKey = `series_${licenseId}_${collectionId}`;
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
      }
    }

    const url = `${this.baseUrl}/cartes.php?idl=${licenseId}&idc=${collectionId}`;
    const html = await this._fetchWithCircuitBreaker(url);
    const $ = cheerio.load(html);
    
    const series = [];
    const seen = new Set();
    
    $('a[href*="ids="]').each((i, el) => {
      const href = $(el).attr('href');
      const match = href.match(/ids=(\d+)/);
      if (match && !seen.has(match[1])) {
        seen.add(match[1]);
        series.push({
          id: parseInt(match[1]),
          collectionId: parseInt(collectionId),
          licenseId: parseInt(licenseId),
          name: $(el).text().trim()
        });
      }
    });
    
    this.cache.set(cacheKey, {
      data: series,
      timestamp: Date.now()
    });
    
    return series;
  }

  /**
   * Récupère toutes les cartes d'une série
   * Parse: http://www.animecollection.fr/cartes.php?idl=56&idc=195&ids=425
   */
  async getCardsBySerie(licenseId, collectionId, serieId) {
    const cacheKey = `serie_${licenseId}_${collectionId}_${serieId}`;
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
      }
    }

    const url = `${this.baseUrl}/cartes.php?idl=${licenseId}&idc=${collectionId}&ids=${serieId}`;
    const html = await this._fetchWithCircuitBreaker(url);
    const $ = cheerio.load(html);
    
    // Parser métadonnées série depuis le fil d'Ariane
    const breadcrumbLinks = [];
    $('a[href*="cartes.php"]').each((i, el) => {
      breadcrumbLinks.push($(el).text().trim());
    });
    
    const license = breadcrumbLinks[1] || 'Unknown';
    const collection = breadcrumbLinks[2] || 'Unknown';
    const serie = breadcrumbLinks[3] || 'Unknown';
    
    // Parser description de la série
    let description = '';
    let year = null;
    let totalCards = 0;
    let prismCards = 0;
    let regularCards = 0;
    
    $('.titre_vert_cartes').next('p, div').each((i, el) => {
      const text = $(el).text();
      if (text && text.length > 10) {
        description = text.trim();
        
        const yearMatch = text.match(/sortie en (\d{4})/);
        const totalMatch = text.match(/(\d+) cartes/);
        const prismMatch = text.match(/(\d+) prismes?/);
        const regularMatch = text.match(/(\d+) regulars?/);
        
        if (yearMatch) year = parseInt(yearMatch[1]);
        if (totalMatch) totalCards = parseInt(totalMatch[1]);
        if (prismMatch) prismCards = parseInt(prismMatch[1]);
        if (regularMatch) regularCards = parseInt(regularMatch[1]);
      }
    });
    
    // Parser les cartes
    const cards = [];
    let cardNumber = 1;
    
    $('img[src*="_carte.jpg"]').each((i, el) => {
      const imgSrc = $(el).attr('src');
      const match = imgSrc.match(/h\d+_(\d+)_carte\.jpg/);
      
      if (match) {
        const cardId = match[1];
        
        // Essayer de récupérer le numéro affiché avant l'image
        const prevText = $(el).prev().text().trim();
        const displayNumber = prevText && /^\d+$/.test(prevText) ? prevText : cardNumber.toString();
        
        // Déterminer rareté basée sur la position
        const num = parseInt(displayNumber);
        let rarity = 'Regular';
        if (prismCards > 0 && num > (totalCards - prismCards)) {
          rarity = 'Prism';
        }
        
        cards.push({
          id: cardId,
          number: displayNumber,
          license,
          collection,
          serie,
          year,
          rarity,
          images: {
            thumb: imgSrc.replace(/h\d+_/, 'h50_'),
            medium: imgSrc.replace(/h\d+_/, 'h100_'),
            large: imgSrc.replace(/h\d+_/, 'h200_')
          },
          source: 'animecollection.fr',
          detailUrl: `${this.baseUrl}/carte.php?id=${cardId}`
        });
        
        cardNumber++;
      }
    });
    
    const result = {
      license,
      collection,
      serie,
      year,
      totalCards: cards.length || totalCards,
      prismCards,
      regularCards,
      description,
      cards
    };
    
    this.cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });
    
    return result;
  }

  /**
   * Recherche par nom de licence (fuzzy)
   */
  async searchLicenses(query) {
    const allLicenses = await this.getAllLicenses();
    const lowerQuery = query.toLowerCase();
    
    return allLicenses.filter(lic => 
      lic.name.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Fetch avec circuit breaker
   */
  async _fetchWithCircuitBreaker(url) {
    // Vérifier l'état du circuit breaker
    if (this.circuitBreakerState === 'open') {
      const timeSinceFailure = Date.now() - this.lastFailureTime;
      if (timeSinceFailure < this.cooldownPeriod) {
        throw new Error('Circuit breaker is open - service temporarily unavailable');
      }
      // Tenter de fermer le circuit
      this.circuitBreakerState = 'half-open';
    }

    try {
      const response = await fetchViaProxy(url, {
        headers: {
          'User-Agent': 'ToysAPI/4.0.0 (Carddass Collector)',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${url}`);
      }
      
      const html = await response.text();
      
      // Succès - réinitialiser le circuit breaker
      if (this.circuitBreakerState === 'half-open') {
        this.circuitBreakerState = 'closed';
        this.failureCount = 0;
      }
      
      return html;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();
      
      if (this.failureCount >= this.failureThreshold) {
        this.circuitBreakerState = 'open';
      }
      
      throw error;
    }
  }

  /**
   * Status du provider
   */
  isAvailable() {
    if (this.circuitBreakerState === 'open') {
      const timeSinceFailure = Date.now() - this.lastFailureTime;
      return timeSinceFailure >= this.cooldownPeriod;
    }
    return this.circuitBreakerState === 'closed';
  }

  getStats() {
    return {
      state: this.circuitBreakerState,
      failureCount: this.failureCount,
      lastFailure: this.lastFailureTime,
      cacheSize: this.cache.size
    };
  }

  /**
   * Nettoyer le cache expiré
   */
  cleanCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > CACHE_TTL) {
        this.cache.delete(key);
      }
    }
  }
}

export default new CarddassProvider();
