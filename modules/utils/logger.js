/**
 * Centralized logging utility for the selfbot application
 */

const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
};

// Default log level
let currentLogLevel = LOG_LEVELS.INFO;
let enableConsoleLog = false;

/**
 * Initialize logger with configuration
 * @param {Object} config - Configuration object
 * @returns {void}
 */
function initLogger(config) {
    if (config && config.enableConsoleLog !== undefined) {
        enableConsoleLog = config.enableConsoleLog;
    }
}

/**
 * Set the current log level
 * @param {number} level - Log level from LOG_LEVELS
 * @returns {void}
 */
function setLogLevel(level) {
    currentLogLevel = level;
}

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
    return enableConsoleLog || process.env.NODE_ENV === 'development';
}

/**
 * Log base function
 * @param {string} level - Log level name
 * @param {string} logMethod - Console method to use
 * @param {string} message - Log message
 * @param {any[]} args - Additional arguments
 * @returns {void}
 */
function logBase(level, logMethod, message, ...args) {
    if (shouldLog() && currentLogLevel >= LOG_LEVELS[level]) {
        console[logMethod](formatMessage(level, message, args));
    }
}

/**
 * Log an error message
 * @param {string} message - Log message
 * @param {...any} args - Additional arguments
 * @returns {void}
 */
function logError(message, ...args) {
    logBase('ERROR', 'error', message, ...args);
}

/**
 * Log a warning message
 * @param {string} message - Log message
 * @param {...any} args - Additional arguments
 * @returns {void}
 */
function logWarn(message, ...args) {
    logBase('WARN', 'warn', message, ...args);
}

/**
 * Log an info message
 * @param {string} message - Log message
 * @param {...any} args - Additional arguments
 * @returns {void}
 */
function logInfo(message, ...args) {
    logBase('INFO', 'log', message, ...args);
}

/**
 * Log a debug message
 * @param {string} message - Log message
 * @param {...any} args - Additional arguments
 * @returns {void}
 */
function logDebug(message, ...args) {
    logBase('DEBUG', 'log', message, ...args);
}

/**
 * Conditional logging function for backward compatibility
 * @param {...any} args - Arguments to log
 * @returns {void}
 */
function conditionalLog(...args) {
    if (shouldLog()) {
        console.log(...args);
    }
}

/**
 * Create a module-specific logger
 * @param {string} moduleName - Name of the module
 * @returns {Object} Logger object with info, warn, error, debug methods
 */
function createModuleLogger(moduleName) {
    const prefix = `[${moduleName}]`;
    return {
        info: (message, ...args) => logInfo(`${prefix} ${message}`, ...args),
        warn: (message, ...args) => logWarn(`${prefix} ${message}`, ...args),
        error: (message, ...args) => logError(`${prefix} ${message}`, ...args),
        debug: (message, ...args) => logDebug(`${prefix} ${message}`, ...args)
    };
}

/**
 * Module-specific loggers
 */
const Loggers = {
    Farm: createModuleLogger('FARM'),
    Captcha: createModuleLogger('CAPTCHA'),
    Main: createModuleLogger('MAIN'),
    Bot: createModuleLogger('BOT')
};

module.exports = {
    LOG_LEVELS,
    setLogLevel,
    initLogger,
    logError,
    logWarn,
    logInfo,
    logDebug,
    conditionalLog,
    Loggers,
    createModuleLogger
};