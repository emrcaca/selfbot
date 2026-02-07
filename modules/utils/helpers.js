const { conditionalLog } = require('./logger');

/**
 * Create a delay promise
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generate a random integer between min and max (inclusive)
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Random integer
 */
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

/**
 * Generate a token label based on username
 * @param {string} username - Username to generate label for
 * @returns {string} Token label
 */
const getTokenLabel = (username) => {
    if (!username) return 'Token?';
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        const char = username.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    const tokenNumber = Math.abs(hash % 99) + 1;
    return `Token${tokenNumber}`;
};

/**
 * Sanitize error messages to remove sensitive information
 * @param {Error|string} error - Error object or message string
 * @returns {string} Sanitized error message
 */
const sanitizeError = (error) => {
    let errorMessage = error instanceof Error ? error.message : String(error);
    let errorType = error instanceof Error ? error.name : 'Error';

    errorMessage = errorMessage.replace(/\d{17,19}/g, '[ID_REDACTED]');
    errorMessage = errorMessage.replace(/[a-zA-Z0-9_-]{20,}/g, '[TOKEN_REDACTED]');

    return `[${errorType}] ${errorMessage}`;
};

/**
 * Conditional logging function
 * @param {...any} args - Arguments to log
 * @returns {void}
 */
const conditionalLogHelper = (...args) => {
    conditionalLog(...args);
};

module.exports = {
    delay,
    getRandomInt,
    getTokenLabel,
    sanitizeError,
    conditionalLog: conditionalLogHelper
};