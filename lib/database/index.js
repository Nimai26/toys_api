/**
 * lib/database/index.js - Export du module database
 * 
 * toys_api v4.0.0
 */

export {
  initDatabase,
  query,
  queryOne,
  queryAll,
  getClient,
  isDatabaseConnected,
  isCacheEnabled,
  closeDatabase,
  getPoolStats,
  CACHE_MODE,
  DB_ENABLED
} from './connection.js';

export {
  runMigrations,
  checkDatabaseHealth,
  SCHEMA_VERSION
} from './migrations.js';

export {
  generateItemId,
  getItem,
  saveItem,
  getItemWithCache,
  searchLocal,
  saveSearchResults,
  getCachedSearch,
  getStats,
  getPopularItems,
  getItemsToRefresh,
  CACHE_TTL
} from './repository.js';
