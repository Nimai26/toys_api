/**
 * tests/repository.test.js - Tests unitaires pour repository.js
 * 
 * Tests du pattern repository pour le cache PostgreSQL
 * toys_api v4.0.0
 */

import { jest } from '@jest/globals';

// Mock du module connection avant l'import
const mockQuery = jest.fn();
const mockQueryOne = jest.fn();
const mockQueryAll = jest.fn();
const mockIsCacheEnabled = jest.fn(() => true);

jest.unstable_mockModule('../lib/database/connection.js', () => ({
  query: mockQuery,
  queryOne: mockQueryOne,
  queryAll: mockQueryAll,
  isCacheEnabled: mockIsCacheEnabled,
  CACHE_MODE: 'hybrid'
}));

// Import après mock
const { generateItemId, CACHE_TTL } = await import('../lib/database/repository.js');

describe('Repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateItemId', () => {
    it('should generate correct composite ID', () => {
      expect(generateItemId('lego', '42217')).toBe('lego:42217');
      expect(generateItemId('tmdb', '12345')).toBe('tmdb:12345');
      expect(generateItemId('googlebooks', 'abc123')).toBe('googlebooks:abc123');
    });

    it('should handle special characters in sourceId', () => {
      expect(generateItemId('bedetheque', '123-456')).toBe('bedetheque:123-456');
      expect(generateItemId('mangadex', 'uuid-format-id')).toBe('mangadex:uuid-format-id');
    });
  });

  describe('CACHE_TTL', () => {
    it('should have correct TTL for stable providers (90 days)', () => {
      const stableProviders = ['lego', 'bedetheque', 'playmobil', 'mega', 'klickypedia'];
      const expectedTTL = 90 * 24 * 60 * 60;
      
      stableProviders.forEach(provider => {
        expect(CACHE_TTL[provider]).toBe(expectedTTL);
      });
    });

    it('should have correct TTL for medium stability providers (30 days)', () => {
      const mediumProviders = ['googlebooks', 'openlibrary', 'comicvine', 'mangadex'];
      const expectedTTL = 30 * 24 * 60 * 60;
      
      mediumProviders.forEach(provider => {
        expect(CACHE_TTL[provider]).toBe(expectedTTL);
      });
    });

    it('should have correct TTL for frequently updated providers (7 days)', () => {
      const frequentProviders = ['tmdb', 'tvdb', 'rawg', 'igdb', 'jikan'];
      const expectedTTL = 7 * 24 * 60 * 60;
      
      frequentProviders.forEach(provider => {
        expect(CACHE_TTL[provider]).toBe(expectedTTL);
      });
    });

    it('should have a default TTL', () => {
      expect(CACHE_TTL.default).toBe(30 * 24 * 60 * 60);
    });
  });
});

describe('Repository - Database Operations', () => {
  describe('getItem', () => {
    it('should return null when cache is disabled', async () => {
      mockIsCacheEnabled.mockReturnValue(false);
      const { getItem } = await import('../lib/database/repository.js');
      
      const result = await getItem('lego', '42217');
      expect(result).toBeNull();
      expect(mockQueryOne).not.toHaveBeenCalled();
    });

    it('should query database when cache is enabled', async () => {
      mockIsCacheEnabled.mockReturnValue(true);
      mockQueryOne.mockResolvedValue({
        id: 'lego:42217',
        data: { name: 'Test Set' },
        expires_at: new Date(Date.now() + 86400000)
      });
      
      const { getItem } = await import('../lib/database/repository.js');
      const result = await getItem('lego', '42217');
      
      expect(mockQueryOne).toHaveBeenCalled();
    });
  });
});
