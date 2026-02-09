const configManager = require('../config/manager');

/**
 * Global Bot State Definition
 * Centralized state management for the bot instance.
 */
class BotState {
    constructor() {
        // Operational Flags
        this.isRunning = false;
        this.isOwoEnabled = false;
        this.isSleeping = false;
        this.monitoring = false;
        this.enableConsoleLog = false;
        
        // Processing Flags
        this.isProcessingOwo = false;
        this.isProcessingWhWb = false;
        this.captchaDetected = false;
        this.isCaptchaDmHandlerEnabled = true;

        // Farming State
        this.currentChannelIndex = 0;
        this.channelIds = [];
        this.tempFarmChannel = null;
        
        // Timers & Tracking
        this.timedChannels = {};
        this.activeTimedFarm = { 
            channelId: null, 
            startTime: null, 
            timeoutId: null 
        };
        
    }
    
    /**
     * Update state from configuration
     * @param {Object} config 
     */
    initializeConfig(config) {
        this.channelIds = [...(config.CH_IDS || [])];
        this.enableConsoleLog = config.enableConsoleLog || false;
    }
}

// Singleton Instance
const botState = new BotState();

/**
 * Probability configurations for random events
 */
const PROBABILITIES = Object.freeze({
    SLEEP: 0.010,
    TYPING: 0.28
});

/**
 * Delay configurations (ms)
 */
const DELAYS = Object.freeze({
    TYPING: { MIN: 200, MAX: 1000 },
    MESSAGE: { MIN: 200, MAX: 500 },
    OWO: { MIN: 10500, MAX: 13500 },
    WHWB: { MIN: 12500, MAX: 15000 },
    SLEEP: { MIN: 30000, MAX: 60000 },
    CHANNEL_CYCLE: { MIN: 600000, MAX: 900000 },
    COMMAND_DELETE: { MIN: 300, MAX: 800 },
    STATUS_MESSAGE_DELETE: 30000,
    INFO_MESSAGE_DELETE: 15000
});

/**
 * Keywords for CAPTCHA detection
 */
const CAPTCHA_KEYWORDS = Object.freeze([
    'captcha', 'verify', 'real', 'human?', 
    'ban', 'banned', 'suspend', 'complete verification'
]);

/**
 * Stop bot operations
 * @param {boolean} log - Whether to notify via IPC
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
 * @returns {boolean} Success status
 */
function resumeBot() {
    if (botState.captchaDetected) return false;
    
    if (!botState.isRunning) {
        botState.isRunning = true;
        if (process.send) {
            process.send({ type: 'owo_status_update', isOwoEnabled: botState.isOwoEnabled });
        }
    }
    return true;
}

/**
 * Toggle a boolean state property
 * @param {string} key - Property name
 * @param {string} label - Log label
 */
function toggleBooleanState(key, label = key) {
    if (typeof botState[key] === 'boolean') {
        botState[key] = !botState[key];
        console.log(`[STATE] ${label} ${botState[key] ? 'açıldı' : 'kapatıldı'}.`);
        
        if (key === 'isOwoEnabled' && process.send) {
            process.send({ type: 'owo_status_update', isOwoEnabled: botState.isOwoEnabled });
        }
    }
}

/**
 * Check if a loop should continue execution
 * @param {string} type - Loop type ('owo', 'whwb', 'any')
 */
function shouldRunLoop(type = 'any') {
    // Base checks
    if (!botState.isRunning || botState.isSleeping || botState.captchaDetected) return false;
    
    // Specific checks
    if (type === 'owo') {
        return botState.isOwoEnabled && !botState.isProcessingWhWb;
    }
    if (type === 'whwb') {
        return botState.isOwoEnabled && !botState.isProcessingOwo;
    }
    
    return true;
}

/**
 * Wrapper for initializing config
 */
const initializeConfig = (config) => botState.initializeConfig(config);

module.exports = {
    botState,
    DELAYS,
    PROBABILITIES,
    CAPTCHA_KEYWORDS,
    stopBot,
    resumeBot,
    toggleBooleanState,
    shouldRunLoop,
    initializeConfig
};
