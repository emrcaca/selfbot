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
 * Parse a Discord webhook URL to extract ID and token
 * @param {string} url - Webhook URL
 * @returns {Object|null} Object with id and token properties, or null if invalid
 */
const parseWebhookUrl = (url) => {
    const match = url.match(/webhooks\/(\d+)\/([^\/?]+)/);
    return match && match.length === 3 ? { id: match[1], token: match[2] } : null;
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


const { conditionalLog } = require('./logger');

module.exports = {
    delay,
    getRandomInt,
    getTokenLabel,
    parseWebhookUrl,
    sanitizeError,
    conditionalLog
};
