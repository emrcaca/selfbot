const configManager = require('../config/configManager');

/**
 * Global bot state object
 * @property {boolean} isRunning - Whether the bot is currently running
 * @property {boolean} isOwoEnabled - Whether OWO farming is enabled
 * @property {boolean} isSleeping - Whether the bot is currently sleeping
 * @property {boolean} captchaDetected - Whether a CAPTCHA has been detected
 * @property {boolean} isProcessingOwo - Whether OWO command is being processed
 * @property {boolean} isProcessingWhWb - Whether WHWB command is being processed
 * @property {boolean} isCaptchaDmHandlerEnabled - Whether CAPTCHA DM handler is enabled
 * @property {number} currentChannelIndex - Index of the current channel in rotation
 * @property {string[]} channelIds - List of channel IDs for farming
 * @property {Object} timedChannels - Channels with elapsed time tracking
 * @property {Object} activeTimedFarm - Currently active timed farm settings
 * @property {string|null} tempFarmChannel - Temporary farm channel ID
 * @property {boolean} monitoring - Whether channel monitoring is enabled
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
    channelIds: [],
    timedChannels: {},
    activeTimedFarm: { channelId: null, startTime: null, timeoutId: null },
    tempFarmChannel: null,
    monitoring: false,
    enableConsoleLog: false
};

// Initialize channel IDs from config
const initChannelIds = () => {
    const config = configManager.getConfig();
    if (config && config.CH_IDS) {
        botState.channelIds = [...config.CH_IDS];
    }
    if (config && config.enableConsoleLog) {
        botState.enableConsoleLog = config.enableConsoleLog;
    }
};

// Call initialization
initChannelIds();

/**
 * Delay configurations for various bot operations (in milliseconds)
 * @property {Object} TYPING - Typing delay range
 * @property {Object} MESSAGE - Message sending delay range
 * @property {Object} OWO - OWO command delay range
 * @property {Object} WHWB - WHWB command delay range
 * @property {Object} SLEEP - Sleep duration range
 * @property {Object} CHANNEL_CYCLE - Channel cycling delay range
 * @property {Object} COMMAND_DELETE - Command deletion delay range
 * @property {number} STATUS_MESSAGE_DELETE - Status message deletion delay
 * @property {number} INFO_MESSAGE_DELETE - Info message deletion delay
 */
const DELAYS = {
    TYPING: { MIN: 200, MAX: 1000 },
    MESSAGE: { MIN: 200, MAX: 500 },
    OWO: { MIN: 10500, MAX: 13500 },
    WHWB: { MIN: 12500, MAX: 15000 },
    SLEEP: { MIN: 30000, MAX: 60000 },
    CHANNEL_CYCLE: { MIN: 600000, MAX: 900000 },
    COMMAND_DELETE: { MIN: 300, MAX: 800 },
    STATUS_MESSAGE_DELETE: 30000,
    INFO_MESSAGE_DELETE: 15000
};

/**
 * Probability configurations for random events
 * @property {number} SLEEP - Probability of entering sleep mode
 * @property {number} TYPING - Probability of sending typing indicator
 */
const PROBABILITIES = {
    SLEEP: 0.010,
    TYPING: 0.28
};

/**
 * Keywords used to detect CAPTCHA messages
 * @type {string[]}
 */
const CAPTCHA_KEYWORDS = ['captcha', 'verify', 'real', 'human?', 'ban', 'banned', 'suspend', 'complete verification'];

/**
 * Stop the bot operations
 * @param {boolean} log - Whether to send status update
 * @returns {void}
 */
function stopBot(log = true) {
    if (botState.isRunning) {
        botState.isRunning = false;
        if (log && process.send) {
            process.send({ type: 'owo_status_update', isOwoEnabled: botState.isOwoEnabled });
        }
    }
}

/**
 * Resume bot operations
 * @returns {boolean} Whether the bot was resumed
 */
function resumeBot() {
    if (botState.captchaDetected) {
        return false;
    }
    if (!botState.isRunning) {
        botState.isRunning = true;
        if (process.send) {
            process.send({ type: 'owo_status_update', isOwoEnabled: botState.isOwoEnabled });
        }
    }
    return true;
}

/**
 * Toggle a boolean state value
 * @param {string} stateKey - The key of the state to toggle
 * @param {string} logName - The name to use in log messages
 * @returns {void}
 */
function toggleBooleanState(stateKey, logName = stateKey) {
    botState[stateKey] = !botState[stateKey];
    console.log(`[STATE] ${logName} ${botState[stateKey] ? 'açıldı' : 'kapatıldı'}.`);
    if (stateKey === 'isOwoEnabled' && process.send) {
        process.send({ type: 'owo_status_update', isOwoEnabled: botState.isOwoEnabled });
    }
}

/**
 * Check if a loop should continue running
 * @param {string} loopType - Type of loop ('owo', 'whwb', or 'any')
 * @returns {boolean} Whether the loop should continue
 */
const shouldRunLoop = (loopType = 'any') => {
    if (!botState.isRunning || botState.isSleeping || botState.captchaDetected) return false;
    if (loopType === 'owo' && (!botState.isOwoEnabled || botState.isProcessingWhWb)) return false;
    if (loopType === 'whwb' && (!botState.isOwoEnabled || botState.isProcessingOwo)) return false;
    return true;
};

module.exports = {
    botState,
    DELAYS,
    PROBABILITIES,
    CAPTCHA_KEYWORDS,
    stopBot,
    resumeBot,
    toggleBooleanState,
    shouldRunLoop,
};
