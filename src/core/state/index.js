/**
 * State Manager Module
 *
 * Central state management system that coordinates all state modules
 * including farming, CAPTCHA, monitoring, and user state.
 *
 * @module core/state/index
 */

const { FarmingState } = require('./farmingState');
const { CaptchaState, CAPTCHA_KEYWORDS } = require('./captchaState');
const { MonitoringState } = require('./monitoringState');
const { UserState } = require('./userState');
const configManager = require('../../config/manager');

// ============================================================================
// CONSTANTS
// ============================================================================

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
    OWO: { MIN: 10500, MAX: 12500 },

    /** Delay range between WHWB commands */
    WHWB: { MIN: 15500, MAX: 17500 },

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
// STATE MANAGER CLASS
// ============================================================================

/**
 * State Manager
 *
 * Central state management system that coordinates all state modules.
 * Provides a unified interface for accessing and modifying state.
 */
class StateManager {
    constructor() {
        /** @type {FarmingState} Farming state manager */
        this.farming = new FarmingState();

        /** @type {CaptchaState} CAPTCHA state manager */
        this.captcha = new CaptchaState();

        /** @type {MonitoringState} Monitoring state manager */
        this.monitoring = new MonitoringState();

        /** @type {UserState} User state manager */
        this.user = new UserState();

        /** @type {Object|null} Global configuration */
        this.config = null;
    }

    /**
     * Initialize state from configuration
     * @param {Object} loadedConfig - Configuration object from configManager
     */
    initialize(loadedConfig) {
        this.config = loadedConfig;

        // Initialize farming state with config
        this.farming.setChannelIds(loadedConfig.CH_IDS || []);
        this.user.setConsoleLogEnabled(loadedConfig.enableConsoleLog || false);
    }

    /**
     * Get complete state snapshot
     * @returns {Object} Complete state snapshot
     */
    getSnapshot() {
        return {
            farming: this.farming.getState(),
            captcha: this.captcha.getState(),
            monitoring: this.monitoring.getState(),
            user: this.user.getState()
        };
    }

    /**
     * Reset all state to default values
     */
    resetAll() {
        this.farming.reset();
        this.captcha.reset();
        this.monitoring.reset();
        this.user.reset();
    }

    /**
     * Stop bot operations
     * @param {boolean} sendStatusUpdate - Whether to send status update
     * @returns {boolean} Whether bot was stopped
     */
    stopBot(sendStatusUpdate = true) {
        if (!this.farming.isRunning()) {
            return false;
        }

        this.farming.setRunning(false);

        if (sendStatusUpdate && process.send) {
            process.send({
                type: 'owo_status_update',
                isOwoEnabled: this.farming.isOwoEnabled()
            });
        }

        return true;
    }

    /**
     * Resume bot operations
     * @returns {boolean} Whether bot was resumed
     */
    resumeBot() {
        if (this.captcha.isDetected()) {
            return false;
        }

        if (!this.farming.isRunning()) {
            this.farming.setRunning(true);

            if (process.send) {
                process.send({
                    type: 'owo_status_update',
                    isOwoEnabled: this.farming.isOwoEnabled()
                });
            }
        }

        return true;
    }

    /**
     * Toggle a boolean state value
     * @param {string} stateKey - State key to toggle
     * @param {string} logName - Name for logging
     * @returns {boolean} New state value
     */
    toggleBooleanState(stateKey, logName = stateKey) {
        let newValue;

        switch (stateKey) {
            case 'isOwoEnabled':
                newValue = this.farming.toggleOwoEnabled();
                break;
            case 'isCaptchaDmHandlerEnabled':
                newValue = this.captcha.toggleDmHandlerEnabled();
                break;
            case 'monitoring':
                newValue = this.monitoring.toggleMonitoring();
                break;
            case 'emojiMonitoringEnabled':
                newValue = this.monitoring.toggleEmojiMonitoringEnabled();
                break;
            default:
                throw new Error(`Unknown state key: ${stateKey}`);
        }

        const status = newValue ? 'enabled' : 'disabled';
        if (this.user.isConsoleLogEnabled()) {
            console.log(`[STATE] ${logName} ${status}.`);
        }

        if (stateKey === 'isOwoEnabled' && process.send) {
            process.send({
                type: 'owo_status_update',
                isOwoEnabled: this.farming.isOwoEnabled()
            });
        }

        return newValue;
    }

    /**
     * Check if a loop should continue running
     * @param {string} loopType - Type of loop ('owo', 'whwb', or 'any')
     * @returns {boolean} Whether loop should continue
     */
    shouldRunLoop(loopType = 'any') {
        // Check if CAPTCHA detected
        if (this.captcha.isDetected()) {
            return false;
        }

        switch (loopType) {
            case 'owo':
                return this.farming.shouldRunOwoLoop();
            case 'whwb':
                return this.farming.shouldRunWhWbLoop();
            case 'any':
            default:
                return this.farming.shouldRunAnyLoop();
        }
    }

    /**
     * Start emoji monitoring
     * @param {string} channelId - Channel ID to monitor
     * @param {string} botId - Bot ID to monitor
     * @param {string[]} emojis - Emojis to monitor
     */
    startEmojiMonitoring(channelId, botId, emojis) {
        this.monitoring.startEmojiMonitoring(channelId, botId, emojis);

        if (this.user.isConsoleLogEnabled()) {
            console.log(`[STATE] Emoji monitoring started in channel ${channelId} for bot ${botId}`);
        }
    }

    /**
     * Stop emoji monitoring
     */
    stopEmojiMonitoring() {
        this.monitoring.stopEmojiMonitoring();

        if (this.user.isConsoleLogEnabled()) {
            console.log('[STATE] Emoji monitoring stopped');
        }
    }

    /**
     * Check if emoji monitoring is enabled
     * @returns {boolean} Whether emoji monitoring is enabled
     */
    isEmojiMonitoringEnabled() {
        return this.monitoring.isEmojiMonitoringEnabled();
    }

    /**
     * Get user channel list
     * @param {string} userId - User ID
     * @returns {string[]} Array of channel IDs
     */
    getUserChannelList(userId) {
        return this.user.getUserChannelList(userId);
    }

    /**
     * Set user channel list
     * @param {string} userId - User ID
     * @param {string[]} channelIds - Array of channel IDs
     */
    setUserChannelList(userId, channelIds) {
        this.user.setUserChannelList(userId, channelIds);
    }

    /**
     * Check if user has custom channel list
     * @param {string} userId - User ID
     * @returns {boolean} Whether user has custom channel list
     */
    hasUserChannelList(userId) {
        return this.user.hasUserChannelList(userId);
    }

    /**
     * Remove user channel list
     * @param {string} userId - User ID
     * @returns {boolean} Whether list was removed
     */
    removeUserChannelList(userId) {
        return this.user.removeUserChannelList(userId);
    }

    /**
     * Get current channel ID
     * @returns {string|null} Current channel ID or null
     */
    getCurrentChannelId() {
        return this.farming.getCurrentChannelId();
    }

    /**
     * Advance to next channel
     * @returns {Object|null} Channel change info or null
     */
    advanceToNextChannel() {
        return this.farming.advanceToNextChannel();
    }

    /**
     * Get farming statistics
     * @returns {Object} Farming statistics
     */
    getFarmingStats() {
        return {
            isRunning: this.farming.isRunning(),
            isOwoEnabled: this.farming.isOwoEnabled(),
            isSleeping: this.farming.isSleeping(),
            isProcessingOwo: this.farming.isProcessingOwo(),
            isProcessingWhWb: this.farming.isProcessingWhWb(),
            currentChannel: this.farming.getCurrentChannelId(),
            channelCount: this.farming.getChannelIds().length,
            tempFarmChannel: this.farming.getTempFarmChannel()
        };
    }
}

// ============================================================================
// GLOBAL STATE MANAGER INSTANCE
// ============================================================================

/**
 * Global state manager instance
 * @type {StateManager}
 */
const stateManager = new StateManager();

// ============================================================================
// LEGACY COMPATIBILITY
// ============================================================================

/**
 * Legacy botState object for backward compatibility
 * @deprecated Use stateManager instead
 */
const botState = new Proxy({}, {
    get(target, prop) {
        // Map legacy botState properties to new state manager
        switch (prop) {
            // Farming state
            case 'isRunning':
                return stateManager.farming.isRunning();
            case 'isOwoEnabled':
                return stateManager.farming.isOwoEnabled();
            case 'isSleeping':
                return stateManager.farming.isSleeping();
            case 'isProcessingOwo':
                return stateManager.farming.isProcessingOwo();
            case 'isProcessingWhWb':
                return stateManager.farming.isProcessingWhWb();
            case 'currentChannelIndex':
                return stateManager.farming.getCurrentChannelIndex();
            case 'channelIds':
                return stateManager.farming.getChannelIds();
            case 'tempFarmChannel':
                return stateManager.farming.getTempFarmChannel();

            // CAPTCHA state
            case 'captchaDetected':
                return stateManager.captcha.isDetected();
            case 'isCaptchaDmHandlerEnabled':
                return stateManager.captcha.isDmHandlerEnabled();
            case 'captchaWebhookMessages':
                return stateManager.captcha.getWebhookMessages();
            case 'captchaWebhookDeleteTimer':
                return stateManager.captcha.getWebhookDeleteTimer();

            // Monitoring state
            case 'monitoring':
                return stateManager.monitoring.isMonitoring();
            case 'emojiMonitoringEnabled':
                return stateManager.monitoring.isEmojiMonitoringEnabled();
            case 'monitoredBotId':
                return stateManager.monitoring.getMonitoredBotId();
            case 'monitoredEmojis':
                return stateManager.monitoring.getMonitoredEmojis();
            case 'monitoredChannelId':
                return stateManager.monitoring.getMonitoredChannelId();
            case 'timedChannels':
                return stateManager.monitoring.getTimedChannels();
            case 'activeTimedFarm':
                return stateManager.monitoring.getActiveTimedFarm();

            // User state
            case 'enableConsoleLog':
                return stateManager.user.isConsoleLogEnabled();
            case 'userChannelLists':
                return stateManager.user.getAllUserChannelLists();

            default:
                return undefined;
        }
    },

    set(target, prop, value) {
        // Map legacy botState properties to new state manager
        switch (prop) {
            // Farming state
            case 'isRunning':
                stateManager.farming.setRunning(value);
                break;
            case 'isOwoEnabled':
                stateManager.farming.setOwoEnabled(value);
                break;
            case 'isSleeping':
                stateManager.farming.setSleeping(value);
                break;
            case 'isProcessingOwo':
                stateManager.farming.setProcessingOwo(value);
                break;
            case 'isProcessingWhWb':
                stateManager.farming.setProcessingWhWb(value);
                break;
            case 'currentChannelIndex':
                stateManager.farming.setCurrentChannelIndex(value);
                break;
            case 'channelIds':
                stateManager.farming.setChannelIds(value);
                break;
            case 'tempFarmChannel':
                stateManager.farming.setTempFarmChannel(value);
                break;

            // CAPTCHA state
            case 'captchaDetected':
                stateManager.captcha.setDetected(value);
                break;
            case 'isCaptchaDmHandlerEnabled':
                stateManager.captcha.setDmHandlerEnabled(value);
                break;
            case 'captchaWebhookMessages':
                stateManager.captcha.setState({ captchaWebhookMessages: value });
                break;
            case 'captchaWebhookDeleteTimer':
                stateManager.captcha.setWebhookDeleteTimer(value);
                break;

            // Monitoring state
            case 'monitoring':
                stateManager.monitoring.setMonitoring(value);
                break;
            case 'emojiMonitoringEnabled':
                stateManager.monitoring.setEmojiMonitoringEnabled(value);
                break;
            case 'monitoredBotId':
                stateManager.monitoring.setMonitoredBotId(value);
                break;
            case 'monitoredEmojis':
                stateManager.monitoring.setMonitoredEmojis(value);
                break;
            case 'monitoredChannelId':
                stateManager.monitoring.setMonitoredChannelId(value);
                break;
            case 'timedChannels':
                stateManager.monitoring.setState({ timedChannels: value });
                break;
            case 'activeTimedFarm':
                stateManager.monitoring.setActiveTimedFarm(value);
                break;

            // User state
            case 'enableConsoleLog':
                stateManager.user.setConsoleLogEnabled(value);
                break;
            case 'userChannelLists':
                stateManager.user.setState({ userChannelLists: value });
                break;

            default:
                // Allow setting new properties
                target[prop] = value;
        }
        return true;
    }
});

// ============================================================================
// LEGACY FUNCTIONS
// ============================================================================

/**
 * Initialize configuration from configManager
 * @param {Object} loadedConfig - Configuration object
 * @deprecated Use stateManager.initialize() instead
 */
function initializeConfig(loadedConfig) {
    stateManager.initialize(loadedConfig);
}

/**
 * Stop the bot
 * @param {boolean} sendStatusUpdate - Whether to send status update
 * @returns {boolean} Whether bot was stopped
 * @deprecated Use stateManager.stopBot() instead
 */
function stopBot(sendStatusUpdate = true) {
    return stateManager.stopBot(sendStatusUpdate);
}

/**
 * Resume the bot
 * @returns {boolean} Whether bot was resumed
 * @deprecated Use stateManager.resumeBot() instead
 */
function resumeBot() {
    return stateManager.resumeBot();
}

/**
 * Toggle a boolean state value
 * @param {string} stateKey - State key to toggle
 * @param {string} logName - Name for logging
 * @returns {boolean} New state value
 * @deprecated Use stateManager.toggleBooleanState() instead
 */
function toggleBooleanState(stateKey, logName = stateKey) {
    return stateManager.toggleBooleanState(stateKey, logName);
}

/**
 * Check if a loop should continue running
 * @param {string} loopType - Type of loop
 * @returns {boolean} Whether loop should continue
 * @deprecated Use stateManager.shouldRunLoop() instead
 */
function shouldRunLoop(loopType = 'any') {
    return stateManager.shouldRunLoop(loopType);
}

/**
 * Reset bot state
 * @deprecated Use stateManager.resetAll() instead
 */
function resetBotState() {
    stateManager.resetAll();
}

/**
 * Set user channel list
 * @param {string} userId - User ID
 * @param {string[]} channelIds - Array of channel IDs
 * @deprecated Use stateManager.setUserChannelList() instead
 */
function setUserChannelList(userId, channelIds) {
    stateManager.setUserChannelList(userId, channelIds);
}

/**
 * Get user channel list
 * @param {string} userId - User ID
 * @returns {string[]} Array of channel IDs
 * @deprecated Use stateManager.getUserChannelList() instead
 */
function getUserChannelList(userId) {
    return stateManager.getUserChannelList(userId);
}

/**
 * Check if user has custom channel list
 * @param {string} userId - User ID
 * @returns {boolean} Whether user has custom channel list
 * @deprecated Use stateManager.hasUserChannelList() instead
 */
function hasUserChannelList(userId) {
    return stateManager.hasUserChannelList(userId);
}

/**
 * Remove user channel list
 * @param {string} userId - User ID
 * @returns {boolean} Whether list was removed
 * @deprecated Use stateManager.removeUserChannelList() instead
 */
function removeUserChannelList(userId) {
    return stateManager.removeUserChannelList(userId);
}

/**
 * Start emoji monitoring
 * @param {string} channelId - Channel ID
 * @param {string} botId - Bot ID
 * @param {string[]} emojis - Emojis to monitor
 * @deprecated Use stateManager.startEmojiMonitoring() instead
 */
function startEmojiMonitoring(channelId, botId, emojis) {
    stateManager.startEmojiMonitoring(channelId, botId, emojis);
}

/**
 * Stop emoji monitoring
 * @deprecated Use stateManager.stopEmojiMonitoring() instead
 */
function stopEmojiMonitoring() {
    stateManager.stopEmojiMonitoring();
}

/**
 * Check if emoji monitoring is enabled
 * @returns {boolean} Whether emoji monitoring is enabled
 * @deprecated Use stateManager.isEmojiMonitoringEnabled() instead
 */
function isEmojiMonitoringEnabled() {
    return stateManager.isEmojiMonitoringEnabled();
}

/**
 * Get bot state snapshot
 * @returns {Object} Bot state snapshot
 * @deprecated Use stateManager.getSnapshot() instead
 */
function getBotStateSnapshot() {
    return stateManager.getSnapshot();
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    // State manager
    stateManager,

    // Legacy compatibility
    botState,

    // Constants
    DELAYS,
    PROBABILITIES,
    CAPTCHA_KEYWORDS,

    // Legacy functions
    initializeConfig,
    stopBot,
    resumeBot,
    toggleBooleanState,
    shouldRunLoop,
    resetBotState,
    setUserChannelList,
    getUserChannelList,
    hasUserChannelList,
    removeUserChannelList,
    startEmojiMonitoring,
    stopEmojiMonitoring,
    isEmojiMonitoringEnabled,
    getBotStateSnapshot
};
