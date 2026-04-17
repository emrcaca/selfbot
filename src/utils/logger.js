/**
 * Centralized logging utility for the selfbot application
 */

const { botState } = require('../core/state');

/**
 * Get formatted timestamp
 * @returns {string} Formatted timestamp
 */
function getTimestamp() {
    return new Date().toISOString();
}

/**
 * Format log message with timestamp and level
 * @param {string} level - Log level name
 * @param {string} message - Log message
 * @param {any[]} args - Additional arguments
 * @returns {string} Formatted log message
 */
function formatMessage(level, message, args) {
    const timestamp = getTimestamp();
    const formattedArgs = args.length > 0 ? ' ' + args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ') : '';
    return `[${timestamp}] [${level}] ${message}${formattedArgs}`;
}

/**
 * Check if logging should occur based on configuration
 * @returns {boolean} Whether to log
 */
function shouldLog() {
    return botState.enableConsoleLog || process.env.NODE_ENV === 'development';
}

/**
 * Log an error message
 * @param {string} message - Log message
 * @param {...any} args - Additional arguments
 * @returns {void}
 */
function logError(message, ...args) {
    if (shouldLog()) {
        console.error(formatMessage('ERROR', message, args));
    }
}

/**
 * Log a warning message
 * @param {string} message - Log message
 * @param {...any} args - Additional arguments
 * @returns {void}
 */
function logWarn(message, ...args) {
    if (shouldLog()) {
        console.warn(formatMessage('WARN', message, args));
    }
}

/**
 * Log an info message
 * @param {string} message - Log message
 * @param {...any} args - Additional arguments
 * @returns {void}
 */
function logInfo(message, ...args) {
    if (shouldLog()) {
        console.log(formatMessage('INFO', message, args));
    }
}

/**
 * Log a debug message
 * @param {string} message - Log message
 * @param {...any} args - Additional arguments
 * @returns {void}
 */
function logDebug(message, ...args) {
    if (shouldLog()) {
        console.log(formatMessage('DEBUG', message, args));
    }
}

/**
 * Module-specific loggers
 */
const Loggers = {
    /**
     * Farming module logger
     */
    Farm: {
        info: (message, ...args) => logInfo(`[FARM] ${message}`, ...args),
        warn: (message, ...args) => logWarn(`[FARM] ${message}`, ...args),
        error: (message, ...args) => logError(`[FARM] ${message}`, ...args),
        debug: (message, ...args) => logDebug(`[FARM] ${message}`, ...args)
    },

    /**
     * Captcha module logger
     */
    Captcha: {
        info: (message, ...args) => logInfo(`[CAPTCHA] ${message}`, ...args),
        warn: (message, ...args) => logWarn(`[CAPTCHA] ${message}`, ...args),
        error: (message, ...args) => logError(`[CAPTCHA] ${message}`, ...args),
        debug: (message, ...args) => logDebug(`[CAPTCHA] ${message}`, ...args)
    },

    /**
     * Webhook module logger
     */
    Webhook: {
        info: (message, ...args) => logInfo(`[WEBHOOK] ${message}`, ...args),
        warn: (message, ...args) => logWarn(`[WEBHOOK] ${message}`, ...args),
        error: (message, ...args) => logError(`[WEBHOOK] ${message}`, ...args),
        debug: (message, ...args) => logDebug(`[WEBHOOK] ${message}`, ...args)
    },

    /**
     * Main process logger
     */
    Main: {
        info: (message, ...args) => logInfo(`[MAIN] ${message}`, ...args),
        warn: (message, ...args) => logWarn(`[MAIN] ${message}`, ...args),
        error: (message, ...args) => logError(`[MAIN] ${message}`, ...args),
        debug: (message, ...args) => logDebug(`[MAIN] ${message}`, ...args)
    },

    /**
     * Bot module logger
     */
    Bot: {
        info: (message, ...args) => logInfo(`[BOT] ${message}`, ...args),
        warn: (message, ...args) => logWarn(`[BOT] ${message}`, ...args),
        error: (message, ...args) => logError(`[BOT] ${message}`, ...args),
        debug: (message, ...args) => logDebug(`[BOT] ${message}`, ...args)
    }
};

module.exports = {
    Loggers
};
