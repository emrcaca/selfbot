/**
 * Application Constants
 *
 * Centralized constants for the application to eliminate magic numbers
 * and improve maintainability.
 *
 * @module config/constants
 */

// ============================================================================
// TIME CONSTANTS (milliseconds)
// ============================================================================

/**
 * Time-related constants in milliseconds
 */
const TIME = {
    /** One second */
    SECOND: 1000,

    /** One minute */
    MINUTE: 60 * 1000,

    /** Five minutes */
    FIVE_MINUTES: 5 * 60 * 1000,

    /** Ten minutes */
    TEN_MINUTES: 10 * 60 * 1000,

    /** Fifteen minutes */
    FIFTEEN_MINUTES: 15 * 60 * 1000,

    /** Thirty minutes */
    THIRTY_MINUTES: 30 * 60 * 1000,

    /** One hour */
    HOUR: 60 * 60 * 1000,

    /** One day */
    DAY: 24 * 60 * 60 * 1000
};

// ============================================================================
// DISCORD API CONSTANTS
// ============================================================================

/**
 * Discord API-related constants
 */
const DISCORD = {
    /** Minimum Discord token length */
    MIN_TOKEN_LENGTH: 50,

    /** OWO bot ID */
    OWO_BOT_ID: '408785106942164992',

    /** Maximum message length */
    MAX_MESSAGE_LENGTH: 2000,

    /** Maximum embed description length */
    MAX_EMBED_DESCRIPTION_LENGTH: 4096,

    /** Maximum embed title length */
    MAX_EMBED_TITLE_LENGTH: 256,

    /** Maximum embed field value length */
    MAX_EMBED_FIELD_VALUE_LENGTH: 1024,

    /** Maximum number of embed fields */
    MAX_EMBED_FIELDS: 25
};

// ============================================================================
// FARMING CONSTANTS
// ============================================================================

/**
 * Farming-related constants
 */
const FARMING = {
    /** Delay range for sending typing indicator (ms) */
    TYPING_DELAY: { MIN: 200, MAX: 1000 },

    /** Delay range between sending messages (ms) */
    MESSAGE_DELAY: { MIN: 200, MAX: 500 },

    /** Delay range between OWO commands (ms) */
    OWO_DELAY: { MIN: 10500, MAX: 12500 },

    /** Delay range between WHWB commands (ms) */
    WHWB_DELAY: { MIN: 15500, MAX: 17500 },

    /** Duration range for bot sleep mode (ms) */
    SLEEP_DURATION: { MIN: 30000, MAX: 60000 },

    /** Delay range for cycling between channels (ms) */
    CHANNEL_CYCLE_DELAY: { MIN: 600000, MAX: 900000 },

    /** Delay range for command deletion (ms) */
    COMMAND_DELETE_DELAY: { MIN: 300, MAX: 800 },

    /** Fixed delay for status message deletion (ms) */
    STATUS_MESSAGE_DELETE_DELAY: 30000,

    /** Fixed delay for info message deletion (ms) */
    INFO_MESSAGE_DELETE_DELAY: 15000,

    /** Fixed delay for CAPTCHA webhook message deletion (ms) */
    CAPTCHA_WEBHOOK_DELETE_DELAY: 10 * 1000,

    /** Delay between loop iterations (ms) */
    LOOP_ITERATION_DELAY: { MIN: 200, MAX: 1000 },

    /** Delay after error recovery (ms) */
    ERROR_RECOVERY_DELAY: 5000,

    /** Delay after critical error (ms) */
    CRITICAL_ERROR_DELAY: 10000
};

// ============================================================================
// PROBABILITY CONSTANTS
// ============================================================================

/**
 * Probability constants (0-1 range)
 */
const PROBABILITY = {
    /** Probability of entering sleep mode (1%) */
    SLEEP: 0.010,

    /** Probability of sending typing indicator (28%) */
    TYPING: 0.28
};

// ============================================================================
// CACHE CONSTANTS
// ============================================================================

/**
 * Cache-related constants
 */
const CACHE = {
    /** Channel cache time-to-live (ms) */
    CHANNEL_TTL: 5 * 60 * 1000,

    /** Message queue delay (ms) */
    MESSAGE_QUEUE_DELAY: 1100,

    /** Message queue initial delay (ms) */
    MESSAGE_QUEUE_INITIAL_DELAY: 100,

    /** Maximum cache size */
    MAX_CACHE_SIZE: 1000
};

// ============================================================================
// PROCESS CONSTANTS
// ============================================================================

/**
 * Process-related constants
 */
const PROCESS = {
    /** Duration to keep interaction responses tracked (ms) */
    INTERACTION_TRACK_DURATION: 20000,

    /** Banner width for ASCII art */
    BANNER_WIDTH: 45,

    /** Process exit codes */
    EXIT_CODE: {
        SUCCESS: 0,
        ERROR: 1
    }
};

// ============================================================================
// GIVEAWAY CONSTANTS
// ============================================================================

/**
 * Giveaway-related constants
 */
const GIVEAWAY = {
    /** Delay before joining giveaway (ms) */
    JOIN_DELAY: 5000,

    /** Emojis for giveaway detection */
    BUTTON_EMOJI: '🎉',
    REACTION_EMOJI: '🎊'
};

// ============================================================================
// EMOJI MONITORING CONSTANTS
// ============================================================================

/**
 * Emoji monitoring-related constants
 */
const EMOJI_MONITORING = {
    /** Default reaction ID for emoji monitoring */
    DEFAULT_REACTION_ID: '519287796549156864',

    /** Maximum message content length for DM notification */
    MAX_MESSAGE_CONTENT_LENGTH: 100
};

// ============================================================================
// CAPTCHA CONSTANTS
// ============================================================================

/**
 * CAPTCHA-related constants
 */
const CAPTCHA = {
    /** Keywords used to detect CAPTCHA messages */
    KEYWORDS: [
        'captcha',
        'verify',
        'real',
        'human?',
        'ban',
        'banned',
        'suspend',
        'complete verification'
    ]
};

// ============================================================================
// VALIDATION CONSTANTS
// ============================================================================

/**
 * Validation-related constants
 */
const VALIDATION = {
    /** Regular expression for validating Discord IDs (numeric only) */
    DISCORD_ID_REGEX: /^\d+$/,

    /** Placeholder patterns that indicate configuration needs replacement */
    PLACEHOLDER_PATTERNS: ['YOUR_', 'your_token_here', 'your_bot_token_here'],

    /** Maximum number of retries for failed operations */
    MAX_RETRIES: 3,

    /** Delay between retries (ms) */
    RETRY_DELAY: 1000
};

// ============================================================================
// LOGGING CONSTANTS
// ============================================================================

/**
 * Logging-related constants
 */
const LOGGING = {
    /** Log levels */
    LEVEL: {
        ERROR: 0,
        WARN: 1,
        INFO: 2,
        DEBUG: 3
    },

    /** Default log level */
    DEFAULT_LEVEL: 2
};

// ============================================================================
// ASYNC QUEUE CONSTANTS
// ============================================================================

/**
 * Async queue-related constants
 */
const ASYNC_QUEUE = {
    /** Default concurrency for async operations */
    DEFAULT_CONCURRENCY: 5,

    /** Maximum queue size */
    MAX_QUEUE_SIZE: 100,

    /** Queue timeout (ms) */
    QUEUE_TIMEOUT: 30000
};

// ============================================================================
// RATE LIMITING CONSTANTS
// ============================================================================

/**
 * Rate limiting-related constants
 */
const RATE_LIMITING = {
    /** Token bucket capacity */
    BUCKET_CAPACITY: 10,

    /** Token refill rate (tokens per second) */
    REFILL_RATE: 1,

    /** Per-channel rate limit (requests per minute) */
    PER_CHANNEL_LIMIT: 30,

    /** Global rate limit (requests per minute) */
    GLOBAL_LIMIT: 50
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    TIME,
    DISCORD,
    FARMING,
    PROBABILITY,
    CACHE,
    PROCESS,
    GIVEAWAY,
    EMOJI_MONITORING,
    CAPTCHA,
    VALIDATION,
    LOGGING,
    ASYNC_QUEUE,
    RATE_LIMITING
};
