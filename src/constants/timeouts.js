/**
 * Time-related constants used throughout the application
 * All durations are in milliseconds
 */

/**
 * Message and interaction timeout constants
 */
const TIMEOUTS = Object.freeze({
    /** Debounce timeout for command results to prevent duplicate responses */
    COMMAND_RESULT_DEBOUNCE: 20000,

    /** IPC request timeout for interaction responses */
    IPC_REQUEST_TIMEOUT: 15000,

    /** Delay before auto-deleting temporary confirmation messages */
    TEMP_MESSAGE_DELETE: 3000,

    /** Delay after CAPTCHA verification before resuming bot */
    CAPTCHA_VERIFY_DELAY: 15000,

    /** Time interval before cleaning up stale CAPTCHA notifications */
    CAPTCHA_NOTIFICATION_CLEANUP: 10 * 60 * 1000, // 10 minutes
});

/**
 * Time limit constants for farming operations
 */
const FARMING_LIMITS = Object.freeze({
    /** Maximum farming time per channel before cooldown required */
    CHANNEL_FARM_LIMIT: 10 * 60 * 1000, // 10 minutes
});

/**
 * Message fetch limits
 */
const MESSAGE_LIMITS = Object.freeze({
    /** Maximum number of messages to fetch for cleanup operations */
    CLEANUP_FETCH_LIMIT: 100,
});

/**
 * Retry delay constants
 */
const RETRY_DELAYS = Object.freeze({
    /** Initial delay before retry when no channel available */
    NO_CHANNEL_RETRY: 5000,

    /** Backoff delay on farming loop error */
    FARM_ERROR_BACKOFF: 5000,

    /** Major backoff delay on fatal farming error */
    FARM_FATAL_BACKOFF: 10000,

    /** Backoff delay on channel cycle error */
    CHANNEL_CYCLE_ERROR_BACKOFF: 10000,
});

/**
 * Random delay ranges for variation
 */
const RANDOM_DELAYS = Object.freeze({
    /** Random delay range before each farming iteration */
    ITERATION_START: { MIN: 500, MAX: 2000 },
});

module.exports = {
    TIMEOUTS,
    FARMING_LIMITS,
    MESSAGE_LIMITS,
    RETRY_DELAYS,
    RANDOM_DELAYS
};
