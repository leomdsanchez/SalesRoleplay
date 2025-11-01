/**
 * Simple Logging System - KISS Principle
 *
 * Centralizes all logging with easy enable/disable for debug logs.
 * Production-safe: debug logs are disabled by default.
 */

// Configuration - can be changed at runtime
export const LOG_CONFIG = {
  enableDebug: false, // Set to true to enable debug logs
  enableInfo: true,   // Info logs always enabled
  enableWarn: true,   // Warning logs always enabled
  enableError: true,  // Error logs always enabled
};

/**
 * Simple logger with levels
 */
export const logger = {
  debug: (message: string, ...args: any[]) => {
    if (LOG_CONFIG.enableDebug) {
      console.log(`🐛 ${message}`, ...args);
    }
  },

  info: (message: string, ...args: any[]) => {
    if (LOG_CONFIG.enableInfo) {
      console.info(`ℹ️ ${message}`, ...args);
    }
  },

  warn: (message: string, ...args: any[]) => {
    if (LOG_CONFIG.enableWarn) {
      console.warn(`⚠️ ${message}`, ...args);
    }
  },

  error: (message: string, ...args: any[]) => {
    if (LOG_CONFIG.enableError) {
      console.error(`❌ ${message}`, ...args);
    }
  },
};

/**
 * Quick functions for common use cases
 */
export const log = {
  // LLM streaming logs
  llm: (message: string, ...args: any[]) => logger.debug(`[LLM] ${message}`, ...args),

  // Audio player logs
  audio: (message: string, ...args: any[]) => logger.debug(`[Audio] ${message}`, ...args),

  // Voice session logs
  voice: (message: string, ...args: any[]) => logger.debug(`[Voice] ${message}`, ...args),

  // WebSocket logs
  ws: (message: string, ...args: any[]) => logger.debug(`[WS] ${message}`, ...args),

  // API logs
  api: (message: string, ...args: any[]) => logger.info(`[API] ${message}`, ...args),
};

/**
 * Enable/disable debug logging globally
 */
export const setDebugLogging = (enabled: boolean) => {
  LOG_CONFIG.enableDebug = enabled;
  logger.info(`Debug logging ${enabled ? 'ENABLED' : 'DISABLED'}`);
};

/**
 * Get current logging status
 */
export const getLoggingStatus = () => ({
  debug: LOG_CONFIG.enableDebug,
  info: LOG_CONFIG.enableInfo,
  warn: LOG_CONFIG.enableWarn,
  error: LOG_CONFIG.enableError,
});
