/**
 * Error Handler Utilities
 *
 * Centralized error handling for the application including:
 * - Uncaught exception handling
 * - Unhandled promise rejection handling
 *
 * @module utils/errorHandler
 */

const { Loggers } = require('./logger');

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
    Loggers.Bot.error(`Uncaught exception: ${error.message}`);
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
    Loggers.Bot.error(`Unhandled rejection: ${reason}`);
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    handleUncaughtException,
    handleUnhandledRejection
};
