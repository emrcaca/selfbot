/**
 * Helper Utilities
 *
 * Collection of utility functions used throughout the application
 * including delays, random number generation, token labeling, and
 * error message sanitization.
 *
 * @module utils/helpers
 */

const { conditionalLog } = require('./logger');

// ============================================================================
// DELAY FUNCTIONS
// ============================================================================

/**
 * Create a delay promise
 *
 * Returns a promise that resolves after the specified number of milliseconds.
 *
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>} Promise that resolves after delay
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a delay that can be cancelled
 *
 * Returns an object with a promise and a cancel function.
 *
 * @param {number} ms - Milliseconds to delay
 * @returns {Object} Object with promise and cancel function
 */
function cancellableDelay(ms) {
    let timeoutId;
    const promise = new Promise((resolve, reject) => {
        timeoutId = setTimeout(resolve, ms);
    });

    return {
        promise,
        cancel: () => {
            clearTimeout(timeoutId);
        }
    };
}

// ============================================================================
// RANDOM NUMBER FUNCTIONS
// ============================================================================

/**
 * Generate a random integer between min and max (inclusive)
 *
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Random integer in range [min, max]
 * @throws {Error} If min > max
 */
function getRandomInt(min, max) {
    if (min > max) {
        throw new Error('min must be less than or equal to max');
    }
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate a random float between min and max (inclusive)
 *
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Random float in range [min, max]
 * @throws {Error} If min > max
 */
function getRandomFloat(min, max) {
    if (min > max) {
        throw new Error('min must be less than or equal to max');
    }
    return Math.random() * (max - min) + min;
}

/**
 * Pick a random element from an array
 *
 * @param {Array} array - Array to pick from
 * @returns {*} Random element from array
 * @throws {Error} If array is empty
 */
function pickRandom(array) {
    if (!Array.isArray(array) || array.length === 0) {
        throw new Error('Cannot pick from empty array');
    }
    return array[Math.floor(Math.random() * array.length)];
}

/**
 * Shuffle an array (returns new array)
 *
 * @param {Array} array - Array to shuffle
 * @returns {Array} New shuffled array
 */
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// ============================================================================
// STRING UTILITIES
// ============================================================================

/**
 * Generate a token label based on username
 *
 * Creates a consistent label (Token1, Token2, etc.) based on the
 * username hash. Useful for identifying different tokens in logs.
 *
 * @param {string} username - Username to generate label for
 * @returns {string} Token label (e.g., "Token42")
 */
function getTokenLabel(username) {
    if (!username) {
        return 'Token?';
    }

    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        const char = username.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }

    const tokenNumber = Math.abs(hash % 99) + 1;
    return `Token${tokenNumber}`;
}

/**
 * Truncate a string to a maximum length
 *
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length
 * @param {string} suffix - Suffix to add if truncated (default: '...')
 * @returns {string} Truncated string
 */
function truncateString(str, maxLength, suffix = '...') {
    if (!str || str.length <= maxLength) {
        return str || '';
    }

    return str.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Capitalize the first letter of a string
 *
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
function capitalize(str) {
    if (!str) {
        return '';
    }
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert milliseconds to human-readable format
 *
 * @param {number} ms - Milliseconds
 * @returns {string} Human-readable duration (e.g., "1h 30m 45s")
 */
function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    const parts = [];

    if (days > 0) {
        parts.push(`${days}d`);
    }

    if (hours % 24 > 0) {
        parts.push(`${hours % 24}h`);
    }

    if (minutes % 60 > 0) {
        parts.push(`${minutes % 60}m`);
    }

    if (seconds % 60 > 0 || parts.length === 0) {
        parts.push(`${seconds % 60}s`);
    }

    return parts.join(' ');
}

// ============================================================================
// URL/DISCORD UTILITIES
// ============================================================================

/**
 * Parse a Discord webhook URL to extract ID and token
 *
 * @param {string} url - Webhook URL
 * @returns {Object|null} Object with id and token properties, or null if invalid
 */
function parseWebhookUrl(url) {
    if (!url || typeof url !== 'string') {
        return null;
    }

    const match = url.match(/webhooks\/(\d+)\/([^\/?]+)/);
    return match && match.length === 3
        ? { id: match[1], token: match[2] }
        : null;
}

/**
 * Parse a Discord channel invite URL
 *
 * @param {string} url - Invite URL
 * @returns {string|null} Invite code or null if invalid
 */
function parseInviteUrl(url) {
    if (!url || typeof url !== 'string') {
        return null;
    }

    // Match various invite URL formats
    const match = url.match(/(?:discord\.gg\/|discord\.com\/invite\/|discord\.io\/)([a-zA-Z0-9-]+)/);
    return match ? match[1] : null;
}

/**
 * Check if a string is a valid Discord ID
 *
 * @param {string} id - ID to validate
 * @returns {boolean} True if valid Discord ID
 */
function isValidDiscordId(id) {
    return typeof id === 'string' && /^\d{17,19}$/.test(id);
}

// ============================================================================
// ERROR SANITIZATION
// ============================================================================

/**
 * Sanitize error messages to remove sensitive information
 *
 * Removes Discord IDs, tokens, and other sensitive data from error messages.
 *
 * @param {Error|string} error - Error object or message string
 * @returns {string} Sanitized error message
 */
function sanitizeError(error) {
    let errorMessage = error instanceof Error ? error.message : String(error);
    let errorType = error instanceof Error ? error.name : 'Error';

    // Remove Discord IDs (17-19 digits)
    errorMessage = errorMessage.replace(/\d{17,19}/g, '[ID_REDACTED]');

    // Remove tokens (alphanumeric strings 20+ characters)
    errorMessage = errorMessage.replace(/[a-zA-Z0-9_-]{20,}/g, '[TOKEN_REDACTED]');

    // Remove potential webhook URLs
    errorMessage = errorMessage.replace(/webhooks\/\d+\/[a-zA-Z0-9_-]+/g, '[WEBHOOK_REDACTED]');

    return `[${errorType}] ${errorMessage}`;
}

/**
 * Sanitize an object by removing sensitive values
 *
 * @param {Object} obj - Object to sanitize
 * @param {string[]} sensitiveKeys - Keys to redact
 * @returns {Object} Sanitized object
 */
function sanitizeObject(obj, sensitiveKeys = ['token', 'password', 'secret', 'key']) {
    const sanitized = { ...obj };

    for (const key of Object.keys(sanitized)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
            sanitized[key] = '[REDACTED]';
        }
    }

    return sanitized;
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validate if a value is not null or undefined
 *
 * @param {*} value - Value to check
 * @returns {boolean} True if value is defined
 */
function isDefined(value) {
    return value !== null && value !== undefined;
}

/**
 * Validate if a value is a non-empty string
 *
 * @param {*} value - Value to check
 * @returns {boolean} True if value is a non-empty string
 */
function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validate if a value is a positive number
 *
 * @param {*} value - Value to check
 * @returns {boolean} True if value is a positive number
 */
function isPositiveNumber(value) {
    return typeof value === 'number' && value > 0 && !isNaN(value);
}

/**
 * Validate if a value is an array with elements
 *
 * @param {*} value - Value to check
 * @returns {boolean} True if value is a non-empty array
 */
function isNonEmptyArray(value) {
    return Array.isArray(value) && value.length > 0;
}

// ============================================================================
// TYPE CHECKING UTILITIES
// ============================================================================

/**
 * Get the type of a value
 *
 * @param {*} value - Value to check
 * @returns {string} Type of the value
 */
function getType(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
}

/**
 * Check if a value is a plain object (not array, null, etc.)
 *
 * @param {*} value - Value to check
 * @returns {boolean} True if value is a plain object
 */
function isPlainObject(value) {
    return getType(value) === 'object' && value !== null && !Array.isArray(value);
}

// ============================================================================
// ARRAY UTILITIES
// ============================================================================

/**
 * Remove duplicates from an array
 *
 * @param {Array} array - Array to deduplicate
 * @returns {Array} Array with duplicates removed
 */
function unique(array) {
    return [...new Set(array)];
}

/**
 * Group array elements by a key function
 *
 * @param {Array} array - Array to group
 * @param {Function} keyFn - Function to extract grouping key
 * @returns {Object} Object with grouped arrays
 */
function groupBy(array, keyFn) {
    return array.reduce((groups, item) => {
        const key = keyFn(item);
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(item);
        return groups;
    }, {});
}

/**
 * Chunk an array into smaller arrays
 *
 * @param {Array} array - Array to chunk
 * @param {number} size - Chunk size
 * @returns {Array} Array of chunks
 */
function chunk(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    // Delay functions
    delay,
    cancellableDelay,

    // Random functions
    getRandomInt,
    getRandomFloat,
    pickRandom,
    shuffleArray,

    // String utilities
    getTokenLabel,
    truncateString,
    capitalize,
    formatDuration,

    // URL/Discord utilities
    parseWebhookUrl,
    parseInviteUrl,
    isValidDiscordId,

    // Error sanitization
    sanitizeError,
    sanitizeObject,

    // Validation utilities
    isDefined,
    isNonEmptyString,
    isPositiveNumber,
    isNonEmptyArray,

    // Type checking
    getType,
    isPlainObject,

    // Array utilities
    unique,
    groupBy,
    chunk,

    // Conditional log (for backward compatibility)
    conditionalLog
};