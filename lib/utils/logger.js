/**
 * Logger structuré pour Toys API
 * Fournit des logs avec niveaux, timestamps et contexte
 */

// Niveaux de log avec priorités
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  none: 4
};

// Niveau minimum à afficher (configurable via env)
const MIN_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL?.toLowerCase()] ?? LOG_LEVELS.info;

// Couleurs ANSI pour le terminal
const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m'
};

// Icônes pour chaque niveau
const ICONS = {
  debug: '🔍',
  info: 'ℹ️',
  warn: '⚠️',
  error: '❌'
};

/**
 * Formate un timestamp ISO
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Formate un message de log
 */
function formatMessage(level, source, message, meta = {}) {
  const timestamp = getTimestamp();
  const icon = ICONS[level] || '';
  const levelUpper = level.toUpperCase().padEnd(5);
  
  // Format: [TIMESTAMP] LEVEL [SOURCE] Message
  let output = `${COLORS.dim}[${timestamp}]${COLORS.reset} `;
  
  switch (level) {
    case 'debug':
      output += `${COLORS.cyan}${levelUpper}${COLORS.reset}`;
      break;
    case 'info':
      output += `${COLORS.green}${levelUpper}${COLORS.reset}`;
      break;
    case 'warn':
      output += `${COLORS.yellow}${levelUpper}${COLORS.reset}`;
      break;
    case 'error':
      output += `${COLORS.red}${levelUpper}${COLORS.reset}`;
      break;
    default:
      output += levelUpper;
  }
  
  if (source) {
    output += ` ${COLORS.magenta}[${source}]${COLORS.reset}`;
  }
  
  output += ` ${message}`;
  
  // Ajouter les métadonnées si présentes
  if (Object.keys(meta).length > 0) {
    output += ` ${COLORS.dim}${JSON.stringify(meta)}${COLORS.reset}`;
  }
  
  return output;
}

/**
 * Log une entrée si le niveau est suffisant
 */
function log(level, source, message, meta = {}) {
  if (LOG_LEVELS[level] < MIN_LEVEL) return;
  
  const formatted = formatMessage(level, source, message, meta);
  
  if (level === 'error') {
    console.error(formatted);
  } else if (level === 'warn') {
    console.warn(formatted);
  } else {
    console.log(formatted);
  }
}

/**
 * Crée un logger avec un source (contexte) pré-défini
 * @param {string} source - Nom du module/composant
 * @returns {Object} Logger avec méthodes debug, info, warn, error
 */
export function createLogger(source) {
  return {
    debug: (message, meta) => log('debug', source, message, meta),
    info: (message, meta) => log('info', source, message, meta),
    warn: (message, meta) => log('warn', source, message, meta),
    error: (message, meta) => log('error', source, message, meta),
    
    // Log une requête HTTP entrante
    request: (req, extra = {}) => {
      const meta = {
        method: req.method,
        path: req.path,
        query: Object.keys(req.query).length > 0 ? req.query : undefined,
        ...extra
      };
      log('info', source, `${req.method} ${req.path}`, meta);
    },
    
    // Log une réponse HTTP
    response: (statusCode, duration, extra = {}) => {
      const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
      log(level, source, `Response ${statusCode}`, { duration: `${duration}ms`, ...extra });
    },
    
    // Log une requête vers une API externe
    external: (service, action, meta = {}) => {
      log('debug', source, `→ ${service}: ${action}`, meta);
    },
    
    // Log le résultat d'une requête externe
    externalResult: (service, success, meta = {}) => {
      const level = success ? 'debug' : 'warn';
      const status = success ? '✓' : '✗';
      log(level, source, `← ${service}: ${status}`, meta);
    }
  };
}

/**
 * Logger global pour les messages système
 */
export const logger = createLogger('System');

/**
 * Middleware Express pour logger les requêtes
 */
export function requestLogger(source = 'HTTP') {
  const log = createLogger(source);
  
  return (req, res, next) => {
    const start = Date.now();
    
    // Log la requête entrante
    log.request(req);
    
    // Intercepter la fin de la réponse
    res.on('finish', () => {
      const duration = Date.now() - start;
      log.response(res.statusCode, duration, {
        path: req.path
      });
    });
    
    next();
  };
}

// Export par défaut
export default {
  createLogger,
  logger,
  requestLogger,
  LOG_LEVELS
};
