/**
 * Error Handler Utilities
 *
 * Centralized error handling for the application including:
 * - Error sanitization for logging
 * - Uncaught exception handling
 * - Unhandled promise rejection handling
 * - Error reporting utilities
 *
 * @module utils/errorHandler
 */

const { logError, conditionalLog } = require('./logger');

// ============================================================================
// CONSTANTS
// ============================================================================

/** Patterns for sensitive data that should be redacted from error messages */
const SENSITIVE_PATTERNS = [
    { pattern: /\d{17,19}/g, replacement: '[ID_REDACTED]' }, // Discord IDs
    { pattern: /[a-zA-Z0-9_-]{20,}/g, replacement: '[TOKEN_REDACTED]' }, // Tokens
    { pattern: /webhooks\/\d+\/[a-zA-Z0-9_-]+/g, replacement: '[WEBHOOK_REDACTED]' }, // Webhooks
    { pattern: /Bearer\s+[a-zA-Z0-9._-]+/g, replacement: 'Bearer [TOKEN_REDACTED]' }, // Bearer tokens
    { pattern: /[a-zA-Z0-9+/]{40,}={0,2}/g, replacement: '[ENCODED_REDACTED]' } // Base64 encoded
];

/** Context tags for different error types */
const ERROR_CONTEXTS = {
    UNCAUGHT_EXCEPTION: 'UNCAUGHT_EXCEPTION',
    UNHANDLED_REJECTION: 'UNHANDLED_REJECTION',
    DISCORD_API: 'DISCORD_API',
    FARMING: 'FARMING',
    CAPTCHA: 'CAPTCHA',
    CONFIG: 'CONFIG',
    NETWORK: 'NETWORK'
};

// ============================================================================
// ERROR SANITIZATION
// ============================================================================

/**
 * Sanitize error messages to remove sensitive information
 *
 * Removes Discord IDs, tokens, webhooks, and other sensitive data
 * from error messages before logging or displaying.
 *
 * @param {Error|string} error - The error to sanitize
 * @returns {string} Sanitized error message
 */
function sanitizeError(error) {
    let errorMessage = error instanceof Error ? error.message : String(error);
    let errorType = error instanceof Error ? error.name : 'Error';

    // Apply all sensitive patterns
    for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
        errorMessage = errorMessage.replace(pattern, replacement);
    }

    return `[${errorType}] ${errorMessage}`;
}

/**
 * Sanitize an error object completely
 *
 * Creates a safe representation of an error object with
 * sensitive data removed from all properties.
 *
 * @param {Error} error - The error to sanitize
 * @returns {Object} Sanitized error object
 */
function sanitizeErrorObject(error) {
    const sanitized = {
        name: error.name,
        message: sanitizeError(error),
        stack: error.stack ? sanitizeError(error.stack) : undefined
    };

    // Add additional properties if they exist
    if (error.code) sanitized.code = error.code;
    if (error.status) sanitized.status = error.status;
    if (error.httpStatus) sanitized.httpStatus = error.httpStatus;

    return sanitized;
}

// ============================================================================
// ERROR LOGGING
// ============================================================================

/**
 * Log error with context and sanitization
 *
 * Logs an error with the specified context after sanitizing
 * the error message to remove sensitive information.
 *
 * @param {string} context - Context where error occurred
 * @param {Error|any} error - The error to log
 * @param {Object} metadata - Additional metadata to log
 */
function logErrorWithContext(context, error, metadata = {}) {
    const sanitizedError = sanitizeError(error);
    const sanitizedMetadata = sanitizeMetadata(metadata);

    const logMessage = `[${context}] ${sanitizedError}`;

    if (Object.keys(sanitizedMetadata).length > 0) {
        logError(logMessage, sanitizedMetadata);
    } else {
        logError(logMessage);
    }

    // Additional error reporting could be added here
    // For example, sending to external logging service
}

/**
 * Sanitize metadata object for logging
 *
 * Removes sensitive values from metadata objects.
 *
 * @param {Object} metadata - Metadata to sanitize
 * @returns {Object} Sanitized metadata
 */
function sanitizeMetadata(metadata) {
    const sanitized = {};

    for (const [key, value] of Object.entries(metadata)) {
        const lowerKey = key.toLowerCase();

        // Skip sensitive keys
        if (['token', 'password', 'secret', 'key', 'auth'].some(sensitive => lowerKey.includes(sensitive))) {
            sanitized[key] = '[REDACTED]';
        } else if (typeof value === 'string') {
            sanitized[key] = sanitizeError(value);
        } else if (typeof value === 'object' && value !== null) {
            sanitized[key] = JSON.stringify(value, null, 2);
        } else {
            sanitized[key] = value;
        }
    }

    return sanitized;
}

/**
 * Create an error with context
 *
 * Creates a new error with additional context information.
 *
 * @param {string} message - Error message
 * @param {string} context - Context where error occurred
 * @param {Error} originalError - Original error that caused this error
 * @returns {Error} Error with context
 */
function createContextualError(message, context, originalError = null) {
    const error = new Error(`[${context}] ${message}`);

    if (originalError) {
        error.cause = originalError;
        error.stack = `${error.stack}\n\nCaused by:\n${originalError.stack}`;
    }

    return error;
}

// ============================================================================
// GLOBAL ERROR HANDLERS
// ============================================================================

/**
 * Handle uncaught exceptions
 *
 * Global handler for uncaught exceptions. Logs the error and
 * exits the process with a non-zero exit code.
 *
 * @param {Error} error - The uncaught error
 */
function handleUncaughtException(error) {
    const sanitizedError = sanitizeErrorObject(error);

    logError(
        ERROR_CONTEXTS.UNCAUGHT_EXCEPTION,
        new Error(sanitizedError.message),
        {
            name: sanitizedError.name,
            code: sanitizedError.code,
            status: sanitizedError.status
        }
    );

    conditionalLog('Application encountered an uncaught exception. Exiting...');

    // Exit with error code
    process.exit(1);
}

/**
 * Handle unhandled promise rejections
 *
 * Global handler for unhandled promise rejections. Logs the rejection
 * reason but continues execution (as Node.js does by default).
 *
 * @param {Error|any} reason - Reason for rejection
 * @param {Promise} promise - The rejected promise
 */
function handleUnhandledRejection(reason, promise) {
    let error;

    if (reason instanceof Error) {
        error = reason;
    } else {
        error = new Error(String(reason));
    }

    const sanitizedError = sanitizeErrorObject(error);

    logError(
        ERROR_CONTEXTS.UNHANDLED_REJECTION,
        new Error(sanitizedError.message),
        {
            name: sanitizedError.name,
            code: sanitizedError.code,
            status: sanitizedError.status
        }
    );

    conditionalLog('Application encountered an unhandled promise rejection. Continuing...');
}

// ============================================================================
// ERROR CLASSIFICATION
// ============================================================================

/**
 * Classify an error by type
 *
 * Determines the type of error based on its properties and message.
 *
 * @param {Error} error - Error to classify
 * @returns {string} Error type
 */
function classifyError(error) {
    // Network errors
    if (error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND' ||
        error.code === 'ECONNRESET') {
        return ERROR_CONTEXTS.NETWORK;
    }

    // Discord API errors
    if (error.code && error.code >= 10000 && error.code < 20000) {
        return ERROR_CONTEXTS.DISCORD_API;
    }

    // HTTP errors
    if (error.status || error.httpStatus) {
        const status = error.status || error.httpStatus;

        if (status >= 400 && status < 500) {
            return 'CLIENT_ERROR';
        } else if (status >= 500) {
            return 'SERVER_ERROR';
        }
    }

    // Check error message content
    const message = error.message.toLowerCase();
    if (message.includes('discord') || message.includes('api')) {
        return ERROR_CONTEXTS.DISCORD_API;
    } else if (message.includes('captcha') || message.includes('verify')) {
        return ERROR_CONTEXTS.CAPTCHA;
    } else if (message.includes('config') || message.includes('env')) {
        return ERROR_CONTEXTS.CONFIG;
    } else if (message.includes('farm') || message.includes('owo')) {
        return ERROR_CONTEXTS.FARMING;
    }

    return 'UNKNOWN';
}

/**
 * Check if an error is retryable
 *
 * Determines if an error can be retried based on its type.
 *
 * @param {Error} error - Error to check
 * @returns {boolean} True if error is retryable
 */
function isRetryableError(error) {
    const errorType = classifyError(error);

    // Network errors are generally retryable
    if (errorType === ERROR_CONTEXTS.NETWORK) {
        return true;
    }

    // Server errors (5xx) are retryable
    if (errorType === 'SERVER_ERROR') {
        return true;
    }

    // Rate limit errors are retryable
    if (error.code === 429) {
        return true;
    }

    // Timeout errors are retryable
    if (error.code === 'ETIMEDOUT' || error.message.toLowerCase().includes('timeout')) {
        return true;
    }

    return false;
}

/**
 * Get retry delay for an error
 *
 * Returns the recommended delay before retrying based on error type.
 *
 * @param {Error} error - Error to check
 * @param {number} attempt - Current attempt number (default: 1)
 * @returns {number} Delay in milliseconds
 */
function getRetryDelay(error, attempt = 1) {
    const errorType = classifyError(error);

    // Rate limit error - use retry-after header if available
    if (error.code === 429) {
        const retryAfter = error.retryAfter || 5;
        return retryAfter * 1000;
    }

    // Network errors - exponential backoff
    if (errorType === ERROR_CONTEXTS.NETWORK) {
        return Math.min(1000 * Math.pow(2, attempt), 30000);
    }

    // Server errors - exponential backoff
    if (errorType === 'SERVER_ERROR') {
        return Math.min(1000 * Math.pow(2, attempt), 60000);
    }

    // Default delay
    return 1000 * attempt;
}

// ============================================================================
// ERROR RECOVERY
// ============================================================================

/**
 * Attempt to recover from an error
 *
 * Provides recovery suggestions based on error type.
 *
 * @param {Error} error - Error to recover from
 * @returns {Object} Recovery options
 */
function getRecoveryOptions(error) {
    const errorType = classifyError(error);
    const options = {
        canRetry: isRetryableError(error),
        retryDelay: getRetryDelay(error),
        suggestions: []
    };

    switch (errorType) {
        case ERROR_CONTEXTS.NETWORK:
            options.suggestions.push('Check your internet connection');
            options.suggestions.push('Verify the service is online');
            break;

        case ERROR_CONTEXTS.DISCORD_API:
            if (error.code === 429) {
                options.suggestions.push('Rate limited - wait before retrying');
            } else if (error.code === 10004) {
                options.suggestions.push('Account banned - check account status');
            } else if (error.code === 10006) {
                options.suggestions.push('Channel not found - verify channel ID');
            }
            break;

        case ERROR_CONTEXTS.CAPTCHA:
            options.suggestions.push('CAPTCHA detected - manual intervention required');
            options.canRetry = false;
            break;

        case ERROR_CONTEXTS.CONFIG:
            options.suggestions.push('Verify configuration file is valid');
            options.suggestions.push('Check environment variables are set');
            options.canRetry = false;
            break;

        default:
            options.suggestions.push('Check error details for more information');
    }

    return options;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    // Constants
    ERROR_CONTEXTS,

    // Sanitization
    sanitizeError,
    sanitizeErrorObject,
    sanitizeMetadata,

    // Error logging
    logError: logErrorWithContext,
    createContextualError,

    // Global handlers
    handleUncaughtException,
    handleUnhandledRejection,

    // Error classification
    classifyError,
    isRetryableError,
    getRetryDelay,

    // Error recovery
    getRecoveryOptions
};