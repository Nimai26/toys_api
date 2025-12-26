/**
 * tests/cache-wrapper.test.js - Tests unitaires pour cache-wrapper.js
 * 
 * Tests du wrapper de cache PostgreSQL
 * toys_api v4.0.0
 */

import { jest } from '@jest/globals';

// Mock des dépendances
const mockGetItem = jest.fn();
const mockSaveItem = jest.fn();
const mockGetCachedSearch = jest.fn();
const mockSaveSearchResults = jest.fn();

jest.unstable_mockModule('../lib/database/repository.js', () => ({
  getItem: mockGetItem,
  saveItem: mockSaveItem,
  getCachedSearch: mockGetCachedSearch,
  saveSearchResults: mockSaveSearchResults,
  CACHE_TTL: { lego: 7776000, default: 2592000 }
}));

jest.unstable_mockModule('../lib/database/connection.js', () => ({
  isCacheEnabled: jest.fn(() => true),
  CACHE_MODE: 'hybrid'
}));

const { createProviderCache, getCacheInfo, resetCacheInfo } = await import('../lib/database/cache-wrapper.js');

describe('CacheWrapper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetCacheInfo();
  });

  describe('createProviderCache', () => {
    it('should create a cache instance for a provider', () => {
      const legoCache = createProviderCache('lego', 'construct_toy');
      
      expect(legoCache).toBeDefined();
      expect(typeof legoCache.getWithCache).toBe('function');
      expect(typeof legoCache.searchWithCache).toBe('function');
      expect(typeof legoCache.invalidate).toBe('function');
    });

    it('should create different instances for different providers', () => {
      const legoCache = createProviderCache('lego', 'construct_toy');
      const tmdbCache = createProviderCache('tmdb', 'movie');
      
      expect(legoCache).not.toBe(tmdbCache);
    });
  });

  describe('getCacheInfo', () => {
    it('should return MISS by default', () => {
      resetCacheInfo();
      const info = getCacheInfo();
      
      expect(info.status).toBe('MISS');
    });
  });

  describe('getWithCache', () => {
    it('should return cached data on HIT', async () => {
      const cachedData = { name: 'Test LEGO Set', year: 2024 };
      mockGetItem.mockResolvedValue({
        data: cachedData,
        expires_at: new Date(Date.now() + 86400000) // Valid for 1 day
      });

      const legoCache = createProviderCache('lego', 'construct_toy');
      const fetchFn = jest.fn().mockResolvedValue({ name: 'Fresh Data' });
      
      const result = await legoCache.getWithCache('42217', fetchFn);
      
      expect(result).toEqual(cachedData);
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('should fetch fresh data on MISS', async () => {
      mockGetItem.mockResolvedValue(null);
      mockSaveItem.mockResolvedValue(true);
      
      const freshData = { name: 'Fresh LEGO Set', year: 2024 };
      const legoCache = createProviderCache('lego', 'construct_toy');
      const fetchFn = jest.fn().mockResolvedValue(freshData);
      
      const result = await legoCache.getWithCache('42217', fetchFn);
      
      expect(fetchFn).toHaveBeenCalled();
      expect(result).toEqual(freshData);
    });

    it('should force refresh when forceRefresh is true', async () => {
      const cachedData = { name: 'Old Data' };
      mockGetItem.mockResolvedValue({
        data: cachedData,
        expires_at: new Date(Date.now() + 86400000)
      });
      mockSaveItem.mockResolvedValue(true);
      
      const freshData = { name: 'Fresh Data' };
      const legoCache = createProviderCache('lego', 'construct_toy');
      const fetchFn = jest.fn().mockResolvedValue(freshData);
      
      const result = await legoCache.getWithCache('42217', fetchFn, { forceRefresh: true });
      
      expect(fetchFn).toHaveBeenCalled();
      expect(result).toEqual(freshData);
    });
  });

  describe('searchWithCache', () => {
    it('should return cached search results on HIT', async () => {
      const cachedResults = { results: [{ name: 'Set 1' }, { name: 'Set 2' }], total: 2 };
      mockGetCachedSearch.mockResolvedValue(cachedResults);

      const legoCache = createProviderCache('lego', 'construct_toy');
      const searchFn = jest.fn().mockResolvedValue({ results: [], total: 0 });
      
      const result = await legoCache.searchWithCache('star wars', searchFn);
      
      expect(result).toEqual(cachedResults);
      expect(searchFn).not.toHaveBeenCalled();
    });

    it('should execute search on MISS', async () => {
      mockGetCachedSearch.mockResolvedValue(null);
      mockSaveSearchResults.mockResolvedValue(true);
      
      const searchResults = { results: [{ name: 'New Result' }], total: 1 };
      const legoCache = createProviderCache('lego', 'construct_toy');
      const searchFn = jest.fn().mockResolvedValue(searchResults);
      
      const result = await legoCache.searchWithCache('technic', searchFn);
      
      expect(searchFn).toHaveBeenCalled();
      expect(result).toEqual(searchResults);
    });
  });

  describe('invalidate', () => {
    it('should invalidate cached item', async () => {
      const legoCache = createProviderCache('lego', 'construct_toy');
      
      // invalidate devrait appeler une fonction de suppression
      await expect(legoCache.invalidate('42217')).resolves.not.toThrow();
    });
  });
});
