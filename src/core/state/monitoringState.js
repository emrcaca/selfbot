/**
 * Monitoring State Module
 *
 * Manages state related to monitoring operations including emoji monitoring,
 * channel monitoring, and timed farming.
 *
 * @module core/state/monitoringState
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default monitoring state values
 */
const DEFAULT_MONITORING_STATE = {
    monitoring: false,
    emojiMonitoringEnabled: false,
    monitoredBotId: null,
    monitoredEmojis: [],
    monitoredChannelId: null,
    timedChannels: {},
    activeTimedFarm: {
        channelId: null,
        startTime: null,
        timeoutId: null
    }
};

// ============================================================================
// MONITORING STATE CLASS
// ============================================================================

/**
 * Monitoring State Manager
 *
 * Manages all monitoring-related state including:
 * - Channel monitoring status
 * - Emoji monitoring (bot ID, emojis, channel)
 * - Timed channels tracking
 * - Active timed farm settings
 */
class MonitoringState {
    constructor() {
        /** @type {Object} The monitoring state object */
        this.state = { ...DEFAULT_MONITORING_STATE };
    }

    /**
     * Get the current monitoring state
     * @returns {Object} Copy of the monitoring state
     */
    getState() {
        return { ...this.state };
    }

    /**
     * Set the monitoring state
     * @param {Object} newState - New state values to merge
     */
    setState(newState) {
        this.state = { ...this.state, ...newState };
    }

    /**
     * Reset monitoring state to default values
     */
    reset() {
        this.state = { ...DEFAULT_MONITORING_STATE };
    }

    /**
     * Check if channel monitoring is enabled
     * @returns {boolean} Whether channel monitoring is enabled
     */
    isMonitoring() {
        return this.state.monitoring;
    }

    /**
     * Set channel monitoring status
     * @param {boolean} monitoring - Whether channel monitoring should be enabled
     */
    setMonitoring(monitoring) {
        this.state.monitoring = monitoring;
    }

    /**
     * Toggle channel monitoring status
     * @returns {boolean} New monitoring status
     */
    toggleMonitoring() {
        this.state.monitoring = !this.state.monitoring;
        return this.state.monitoring;
    }

    /**
     * Check if emoji monitoring is enabled
     * @returns {boolean} Whether emoji monitoring is enabled
     */
    isEmojiMonitoringEnabled() {
        return this.state.emojiMonitoringEnabled;
    }

    /**
     * Set emoji monitoring enabled status
     * @param {boolean} enabled - Whether emoji monitoring should be enabled
     */
    setEmojiMonitoringEnabled(enabled) {
        this.state.emojiMonitoringEnabled = enabled;
    }

    /**
     * Toggle emoji monitoring enabled status
     * @returns {boolean} New enabled status
     */
    toggleEmojiMonitoringEnabled() {
        this.state.emojiMonitoringEnabled = !this.state.emojiMonitoringEnabled;
        return this.state.emojiMonitoringEnabled;
    }

    /**
     * Get monitored bot ID
     * @returns {string|null} Monitored bot ID or null
     */
    getMonitoredBotId() {
        return this.state.monitoredBotId;
    }

    /**
     * Set monitored bot ID
     * @param {string|null} botId - Bot ID to monitor or null to clear
     */
    setMonitoredBotId(botId) {
        this.state.monitoredBotId = botId;
    }

    /**
     * Get monitored emojis
     * @returns {string[]} Array of monitored emojis
     */
    getMonitoredEmojis() {
        return [...this.state.monitoredEmojis];
    }

    /**
     * Set monitored emojis
     * @param {string[]} emojis - Array of emojis to monitor
     */
    setMonitoredEmojis(emojis) {
        this.state.monitoredEmojis = [...emojis];
    }

    /**
     * Add a monitored emoji
     * @param {string} emoji - Emoji to add
     */
    addMonitoredEmoji(emoji) {
        if (!this.state.monitoredEmojis.includes(emoji)) {
            this.state.monitoredEmojis.push(emoji);
        }
    }

    /**
     * Remove a monitored emoji
     * @param {string} emoji - Emoji to remove
     * @returns {boolean} Whether emoji was removed
     */
    removeMonitoredEmoji(emoji) {
        const index = this.state.monitoredEmojis.indexOf(emoji);
        if (index !== -1) {
            this.state.monitoredEmojis.splice(index, 1);
            return true;
        }
        return false;
    }

    /**
     * Get monitored channel ID
     * @returns {string|null} Monitored channel ID or null
     */
    getMonitoredChannelId() {
        return this.state.monitoredChannelId;
    }

    /**
     * Set monitored channel ID
     * @param {string|null} channelId - Channel ID to monitor or null to clear
     */
    setMonitoredChannelId(channelId) {
        this.state.monitoredChannelId = channelId;
    }

    /**
     * Start emoji monitoring
     * @param {string} channelId - Channel ID to monitor
     * @param {string} botId - Bot ID to monitor
     * @param {string[]} emojis - Emojis to monitor
     */
    startEmojiMonitoring(channelId, botId, emojis) {
        this.state.emojiMonitoringEnabled = true;
        this.state.monitoredChannelId = channelId;
        this.state.monitoredBotId = botId;
        this.state.monitoredEmojis = [...emojis];
    }

    /**
     * Stop emoji monitoring
     */
    stopEmojiMonitoring() {
        this.state.emojiMonitoringEnabled = false;
        this.state.monitoredChannelId = null;
        this.state.monitoredBotId = null;
        this.state.monitoredEmojis = [];
    }

    /**
     * Get timed channels
     * @returns {Object} Object of timed channels
     */
    getTimedChannels() {
        return { ...this.state.timedChannels };
    }

    /**
     * Get a timed channel
     * @param {string} channelId - Channel ID
     * @returns {Object|null} Timed channel data or null
     */
    getTimedChannel(channelId) {
        return this.state.timedChannels[channelId] || null;
    }

    /**
     * Set a timed channel
     * @param {string} channelId - Channel ID
     * @param {Object} data - Timed channel data
     */
    setTimedChannel(channelId, data) {
        this.state.timedChannels[channelId] = data;
    }

    /**
     * Remove a timed channel
     * @param {string} channelId - Channel ID
     * @returns {boolean} Whether channel was removed
     */
    removeTimedChannel(channelId) {
        if (this.state.timedChannels[channelId]) {
            delete this.state.timedChannels[channelId];
            return true;
        }
        return false;
    }

    /**
     * Clear all timed channels
     */
    clearTimedChannels() {
        this.state.timedChannels = {};
    }

    /**
     * Get active timed farm
     * @returns {Object} Active timed farm data
     */
    getActiveTimedFarm() {
        return { ...this.state.activeTimedFarm };
    }

    /**
     * Set active timed farm
     * @param {Object} data - Active timed farm data
     */
    setActiveTimedFarm(data) {
        this.state.activeTimedFarm = { ...data };
    }

    /**
     * Clear active timed farm
     */
    clearActiveTimedFarm() {
        this.state.activeTimedFarm = {
            channelId: null,
            startTime: null,
            timeoutId: null
        };
    }

    /**
     * Check if has active timed farm
     * @returns {boolean} Whether has active timed farm
     */
    hasActiveTimedFarm() {
        return this.state.activeTimedFarm.channelId !== null;
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    DEFAULT_MONITORING_STATE,
    MonitoringState
};
