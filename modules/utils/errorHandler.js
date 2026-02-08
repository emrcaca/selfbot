/**
 * Centralized error handling utility
 */

const { logError, conditionalLog } = require('./logger');

/**
 * Sanitize error messages to remove sensitive information
 * @param {Error|string} error - The error to sanitize
 * @returns {string} Sanitized error message
 */
function sanitizeError(error) {
    let errorMessage = error instanceof Error ? error.message : String(error);
    let errorType = error instanceof Error ? error.name : 'Error';

    // Remove sensitive data patterns
    errorMessage = errorMessage.replace(/\d{17,19}/g, '[ID_REDACTED]');
    errorMessage = errorMessage.replace(/[a-zA-Z0-9_-]{20,}/g, '[TOKEN_REDACTED]');

    return `[${errorType}] ${errorMessage}`;
}

/**
 * Log error with sanitization
 * @param {string} context - Context where error occurred
 * @param {Error} error - The error to log
 */
function logErrorWithContext(context, error) {
    const sanitizedError = sanitizeError(error);
    logError(`[${context}] ${sanitizedError}`);

    // Additional error reporting could be added here
    // For example, sending to external logging service
}

/**
 * Handle uncaught exceptions
 * @param {Error} error - The uncaught error
 */
function handleUncaughtException(error) {
    logError('UNCAUGHT_EXCEPTION', error);
    conditionalLog('Application encountered an uncaught exception. Exiting...');
    process.exit(1);
}

/**
 * Handle unhandled promise rejections
 * @param {Error|any} reason - Reason for rejection
 * @param {Promise} promise - The rejected promise
 */
function handleUnhandledRejection(reason, promise) {
    logError('UNHANDLED_REJECTION', reason);
    conditionalLog('Application encountered an unhandled promise rejection. Continuing...');
}

module.exports = {
    logError: logErrorWithContext,
    handleUncaughtException,
    handleUnhandledRejection
};