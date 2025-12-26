/**
 * tests/background-jobs.test.js - Tests unitaires pour background-jobs.js
 * 
 * Tests des jobs de maintenance en arrière-plan
 * toys_api v4.0.0
 */

import { jest } from '@jest/globals';

// Mock des dépendances
const mockQuery = jest.fn();
const mockQueryAll = jest.fn();
const mockIsCacheEnabled = jest.fn(() => true);

jest.unstable_mockModule('../lib/database/connection.js', () => ({
  query: mockQuery,
  queryAll: mockQueryAll,
  isCacheEnabled: mockIsCacheEnabled
}));

const { 
  startBackgroundJobs, 
  stopBackgroundJobs, 
  getJobStats, 
  runNow,
  getHealthStats 
} = await import('../lib/database/background-jobs.js');

describe('BackgroundJobs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    stopBackgroundJobs(); // Reset state
  });

  afterEach(() => {
    stopBackgroundJobs(); // Cleanup
  });

  describe('startBackgroundJobs', () => {
    it('should not start if cache is disabled', () => {
      mockIsCacheEnabled.mockReturnValue(false);
      
      const result = startBackgroundJobs();
      expect(result).toBe(false);
    });

    it('should start if cache is enabled', () => {
      mockIsCacheEnabled.mockReturnValue(true);
      
      const result = startBackgroundJobs();
      expect(result).toBe(true);
      
      // Cleanup
      stopBackgroundJobs();
    });

    it('should not start twice', () => {
      mockIsCacheEnabled.mockReturnValue(true);
      
      const first = startBackgroundJobs();
      const second = startBackgroundJobs();
      
      expect(first).toBe(true);
      expect(second).toBe(false);
      
      stopBackgroundJobs();
    });
  });

  describe('stopBackgroundJobs', () => {
    it('should return false if not running', () => {
      const result = stopBackgroundJobs();
      expect(result).toBe(false);
    });

    it('should stop running jobs', () => {
      mockIsCacheEnabled.mockReturnValue(true);
      startBackgroundJobs();
      
      const result = stopBackgroundJobs();
      expect(result).toBe(true);
    });
  });

  describe('getJobStats', () => {
    it('should return current job statistics', () => {
      const stats = getJobStats();
      
      expect(stats).toHaveProperty('isRunning');
      expect(stats).toHaveProperty('lastRunTime');
      expect(stats).toHaveProperty('config');
      expect(stats).toHaveProperty('stats');
    });

    it('should have correct config properties', () => {
      const { config } = getJobStats();
      
      expect(config).toHaveProperty('CHECK_INTERVAL_MS');
      expect(config).toHaveProperty('MAX_REFRESH_PER_CYCLE');
      expect(config).toHaveProperty('REFRESH_DELAY_MS');
    });
  });

  describe('runNow', () => {
    it('should skip if cache is disabled', async () => {
      mockIsCacheEnabled.mockReturnValue(false);
      
      const result = await runNow();
      
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('cache_disabled');
    });

    it('should run maintenance cycle', async () => {
      mockIsCacheEnabled.mockReturnValue(true);
      mockQueryAll.mockResolvedValue([]);
      mockQuery.mockResolvedValue({ total_items: 100, expired_items: 5 });
      
      const result = await runNow();
      
      expect(result.skipped).toBeUndefined();
      expect(result).toHaveProperty('startTime');
      expect(result).toHaveProperty('duration');
    });
  });

  describe('getHealthStats', () => {
    it('should return null if cache is disabled', async () => {
      mockIsCacheEnabled.mockReturnValue(false);
      
      const result = await getHealthStats();
      expect(result).toBeNull();
    });

    it('should query health statistics', async () => {
      mockIsCacheEnabled.mockReturnValue(true);
      mockQuery.mockResolvedValue({
        total_items: 1000,
        expired_items: 50,
        valid_items: 950,
        accessed_today: 100,
        created_today: 10
      });
      
      const result = await getHealthStats();
      
      expect(mockQuery).toHaveBeenCalled();
      expect(result).toHaveProperty('total_items');
    });
  });
});
