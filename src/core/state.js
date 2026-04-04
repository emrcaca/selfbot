/**
 * Bot State Management
 *
 * Manages the global state of the bot including farming status,
 * channel management, CAPTCHA detection, and timing configurations.
 *
 * @module core/state
 */

const configManager = require('../config/manager');

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Keywords used to detect CAPTCHA messages
 */
const CAPTCHA_KEYWORDS = [
    'captcha',
    'verify',
    'human?',
    'ban',
    'banned',
    'suspend',
    'complete verification'
];

/**
 * Delay configurations for various bot operations (in milliseconds)
 *
 * These delays help prevent rate limiting and make the bot behavior
 * more natural and less detectable.
 */
const DELAYS = {
    /** Delay range for sending typing indicator */
    TYPING: { MIN: 200, MAX: 1000 },

    /** Delay range between sending messages */
    MESSAGE: { MIN: 200, MAX: 500 },

    /** Delay range between OWO commands */
    OWO: { MIN: 10500, MAX: 13500 },

    /** Delay range between WHWB commands */
    WHWB: { MIN: 12500, MAX: 15000 },

    /** Duration range for bot sleep mode */
    SLEEP: { MIN: 30000, MAX: 60000 },

    /** Delay range for cycling between channels */
    CHANNEL_CYCLE: { MIN: 600000, MAX: 900000 },

    /** Delay range for command deletion */
    COMMAND_DELETE: { MIN: 300, MAX: 800 },

    /** Fixed delay for status message deletion */
    STATUS_MESSAGE_DELETE: 30000,

    /** Fixed delay for info message deletion */
    INFO_MESSAGE_DELETE: 15000,

    /** Fixed delay for CAPTCHA webhook message deletion */
    CAPTCHA_WEBHOOK_DELETE: 10 * 1000
};

/**
 * Probability configurations for random events
 *
 * These probabilities determine how often certain random behaviors occur,
 * making the bot appear more natural.
 */
const PROBABILITIES = {
    /** Probability of entering sleep mode (1%) */
    SLEEP: 0.010,

    /** Probability of sending typing indicator (28%) */
    TYPING: 0.28
};

// ============================================================================
// CONFIGURATION STATE
// ============================================================================

/**
 * Placeholder configuration for initialization
 * Will be replaced by actual config during app startup
 */
let config = {
    CH_IDS: [],
    enableConsoleLog: false
};

/**
 * Initialize configuration from configManager
 *
 * This function is called during app startup to load the actual
 * configuration and update the bot state accordingly.
 *
 * @param {Object} loadedConfig - Configuration object from configManager
 */
function initializeConfig(loadedConfig) {
    config = loadedConfig;

    // Update botState with loaded config
    botState.channelIds = [...(config.CH_IDS || [])];
    botState.enableConsoleLog = config.enableConsoleLog || false;
}

// ============================================================================
// BOT STATE OBJECT
// ============================================================================

/**
 * Global bot state object
 *
 * This object contains all the mutable state for the bot including
 * farming status, channel management, CAPTCHA detection, and timing.
 *
 * @property {boolean} isRunning - Whether the bot is currently running
 * @property {boolean} isOwoEnabled - Whether OWO farming is enabled
 * @property {boolean} isSleeping - Whether the bot is currently sleeping
 * @property {boolean} captchaDetected - Whether a CAPTCHA has been detected
 * @property {boolean} isProcessingOwo - Whether OWO command is being processed
 * @property {boolean} isProcessingWhWb - Whether WHWB command is being processed
 * @property {boolean} isCaptchaDmHandlerEnabled - Whether CAPTCHA DM handler is enabled
 * @property {number} currentChannelIndex - Index of the current channel in rotation
 * @property {string[]} channelIds - List of channel IDs for farming
 * @property {Array} captchaWebhookMessages - Stored CAPTCHA webhook messages
 * @property {Timeout|null} captchaWebhookDeleteTimer - Timer for deleting CAPTCHA webhook messages
 * @property {Object} timedChannels - Channels with elapsed time tracking
 * @property {Object} activeTimedFarm - Currently active timed farm settings
 * @property {string|null} tempFarmChannel - Temporary farm channel ID
 * @property {boolean} monitoring - Whether channel monitoring is enabled
 * @property {boolean} enableConsoleLog - Whether console logging is enabled
 * @property {Map} userChannelLists - User-specific channel lists for permanent farming
 */
const botState = {
    isRunning: false,
    isOwoEnabled: false,
    isSleeping: false,
    captchaDetected: false,
    isProcessingOwo: false,
    isProcessingWhWb: false,
    isCaptchaDmHandlerEnabled: true,
    currentChannelIndex: 0,
    channelIds: [...(config.CH_IDS || [])],
    captchaWebhookMessages: [],
    captchaWebhookDeleteTimer: null,
    timedChannels: {},
    activeTimedFarm: { channelId: null, startTime: null, timeoutId: null },
    tempFarmChannel: null,
    monitoring: false,
    enableConsoleLog: config.enableConsoleLog || false,
    userChannelLists: new Map() // userId -> channelIds[]
};

// ============================================================================
// STATE MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Stop the bot operations
 *
 * Stops all farming operations and optionally sends a status update
 * to the parent process.
 *
 * @param {boolean} sendStatusUpdate - Whether to send status update to parent process
 * @returns {boolean} True if bot was stopped, false if already stopped
 */
function stopBot(sendStatusUpdate = true) {
    if (!botState.isRunning) {
        return false;
    }

    botState.isRunning = false;

    if (sendStatusUpdate && process.send) {
        process.send({
            type: 'owo_status_update',
            isOwoEnabled: botState.isOwoEnabled
        });
    }

    return true;
}

/**
 * Resume bot operations
 *
 * Resumes farming operations if the bot is not currently stopped
 * by CAPTCHA detection.
 *
 * @returns {boolean} True if bot was resumed, false if CAPTCHA detected
 */
function resumeBot() {
    if (botState.captchaDetected) {
        return false;
    }

    if (!botState.isRunning) {
        botState.isRunning = true;

        if (process.send) {
            process.send({
                type: 'owo_status_update',
                isOwoEnabled: botState.isOwoEnabled
            });
        }
    }

    return true;
}

/**
 * Toggle a boolean state value
 *
 * Toggles the specified boolean state property and logs the change.
 * If the state is 'isOwoEnabled', also sends a status update.
 *
 * @param {string} stateKey - The key of the state to toggle
 * @param {string} logName - The name to use in log messages
 * @returns {boolean} The new value of the toggled state
 */
function toggleBooleanState(stateKey, logName = stateKey) {
    botState[stateKey] = !botState[stateKey];

    const status = botState[stateKey] ? 'enabled' : 'disabled';
    if (botState.enableConsoleLog) {
        console.log(`[STATE] ${logName} ${status}.`);
    }

    if (stateKey === 'isOwoEnabled' && process.send) {
        process.send({
            type: 'owo_status_update',
            isOwoEnabled: botState.isOwoEnabled
        });
    }

    return botState[stateKey];
}

/**
 * Check if a loop should continue running
 *
 * Determines whether a farming loop should continue based on the
 * current bot state. Checks if bot is running, not sleeping, no
 * CAPTCHA detected, and the specific loop type is enabled.
 *
 * @param {string} loopType - Type of loop ('owo', 'whwb', or 'any')
 * @returns {boolean} Whether the loop should continue
 */
function shouldRunLoop(loopType = 'any') {
    // General checks that apply to all loops
    if (!botState.isRunning || botState.isSleeping || botState.captchaDetected) {
        return false;
    }

    // Specific checks for each loop type
    switch (loopType) {
        case 'owo':
            // OWO loop requires OWO enabled and not processing WHWB
            return botState.isOwoEnabled && !botState.isProcessingWhWb;

        case 'whwb':
            // WHWB loop requires OWO enabled and not processing OWO
            return botState.isOwoEnabled && !botState.isProcessingOwo;

        case 'any':
        default:
            return true;
    }
}

/**
 * Reset the bot state to initial values
 *
 * Useful for testing or when restarting the bot without
 * completely reloading the application.
 */
function resetBotState() {
    botState.isRunning = false;
    botState.isOwoEnabled = false;
    botState.isSleeping = false;
    botState.captchaDetected = false;
    botState.isProcessingOwo = false;
    botState.isProcessingWhWb = false;
    botState.currentChannelIndex = 0;
    botState.tempFarmChannel = null;
    botState.monitoring = false;

    // Clear timed channels and active farm
    botState.timedChannels = {};
    botState.activeTimedFarm = { channelId: null, startTime: null, timeoutId: null };
}

/**
 * Set channel list for a specific user
 *
 * @param {string} userId - User ID
 * @param {string[]} channelIds - Array of channel IDs
 */
function setUserChannelList(userId, channelIds) {
    botState.userChannelLists.set(userId, channelIds);
}

/**
 * Get channel list for a specific user
 *
 * @param {string} userId - User ID
 * @returns {string[]} Array of channel IDs for the user, or empty array if not set
 */
function getUserChannelList(userId) {
    return botState.userChannelLists.get(userId) || [];
}

/**
 * Check if user has a custom channel list
 *
 * @param {string} userId - User ID
 * @returns {boolean} Whether the user has a custom channel list
 */
function hasUserChannelList(userId) {
    return botState.userChannelLists.has(userId);
}

/**
 * Remove user-specific channel list (reset to default)
 *
 * @param {string} userId - User ID
 * @returns {boolean} Whether the list was removed
 */
function removeUserChannelList(userId) {
    return botState.userChannelLists.delete(userId);
}

/**
 * Get the current bot state as a plain object
 *
 * Useful for logging or debugging purposes.
 *
 * @returns {Object} Copy of the current bot state
 */
function getBotStateSnapshot() {
    return {
        isRunning: botState.isRunning,
        isOwoEnabled: botState.isOwoEnabled,
        isSleeping: botState.isSleeping,
        captchaDetected: botState.captchaDetected,
        isProcessingOwo: botState.isProcessingOwo,
        isProcessingWhWb: botState.isProcessingWhWb,
        currentChannelIndex: botState.currentChannelIndex,
        channelCount: botState.channelIds.length,
        tempFarmChannel: botState.tempFarmChannel,
        monitoring: botState.monitoring
    };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    // State objects
    botState,
    DELAYS,
    PROBABILITIES,
    CAPTCHA_KEYWORDS,

    // State management functions
    stopBot,
    resumeBot,
    toggleBooleanState,
    setUserChannelList,
    getUserChannelList,
    hasUserChannelList,
    removeUserChannelList,
    shouldRunLoop,
    initializeConfig,
    resetBotState,
    getBotStateSnapshot
};
