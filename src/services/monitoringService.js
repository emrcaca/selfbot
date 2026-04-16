/**
 * Monitoring Service Module
 *
 * Handles monitoring operations including:
 * - Channel monitoring
 * - Emoji monitoring
 * - Timed farming management
 *
 * @module services/monitoringService
 */

const { stateManager } = require('../core/state');
const { Loggers } = require('../utils/logger');
const { EMOJI_MONITORING } = require('../config/constants');

// ============================================================================
// MONITORING SERVICE CLASS
// ============================================================================

/**
 * Monitoring Service
 *
 * Manages all monitoring-related operations including:
 * - Channel monitoring status
 * - Emoji monitoring (bot ID, emojis, channel)
 * - Timed channels tracking
 * - Active timed farm management
 */
class MonitoringService {
    constructor() {
        /** @type {Object} Service configuration */
        this.config = {
            defaultReactionId: EMOJI_MONITORING.DEFAULT_REACTION_ID,
            maxMessageContentLength: EMOJI_MONITORING.MAX_MESSAGE_CONTENT_LENGTH
        };
    }

    // ============================================================================
    // CHANNEL MONITORING
    // ============================================================================

    /**
     * Check if channel monitoring is enabled
     * @returns {boolean} Whether channel monitoring is enabled
     */
    isMonitoring() {
        return stateManager.monitoring.isMonitoring();
    }

    /**
     * Set channel monitoring status
     * @param {boolean} monitoring - Whether channel monitoring should be enabled
     */
    setMonitoring(monitoring) {
        stateManager.monitoring.setMonitoring(monitoring);

        const status = monitoring ? 'enabled' : 'disabled';
        Loggers.Bot.info(`Channel monitoring ${status}`);
    }

    /**
     * Toggle channel monitoring status
     * @returns {boolean} New monitoring status
     */
    toggleMonitoring() {
        const monitoring = stateManager.monitoring.toggleMonitoring();
        const status = monitoring ? 'enabled' : 'disabled';
        Loggers.Bot.info(`Channel monitoring ${status}`);
        return monitoring;
    }

    // ============================================================================
    // EMOJI MONITORING
    // ============================================================================

    /**
     * Check if emoji monitoring is enabled
     * @returns {boolean} Whether emoji monitoring is enabled
     */
    isEmojiMonitoringEnabled() {
        return stateManager.monitoring.isEmojiMonitoringEnabled();
    }

    /**
     * Set emoji monitoring enabled status
     * @param {boolean} enabled - Whether emoji monitoring should be enabled
     */
    setEmojiMonitoringEnabled(enabled) {
        stateManager.monitoring.setEmojiMonitoringEnabled(enabled);

        const status = enabled ? 'enabled' : 'disabled';
        Loggers.Bot.info(`Emoji monitoring ${status}`);
    }

    /**
     * Toggle emoji monitoring enabled status
     * @returns {boolean} New enabled status
     */
    toggleEmojiMonitoringEnabled() {
        const enabled = stateManager.monitoring.toggleEmojiMonitoringEnabled();
        const status = enabled ? 'enabled' : 'disabled';
        Loggers.Bot.info(`Emoji monitoring ${status}`);
        return enabled;
    }

    /**
     * Get monitored bot ID
     * @returns {string|null} Monitored bot ID or null
     */
    getMonitoredBotId() {
        return stateManager.monitoring.getMonitoredBotId();
    }

    /**
     * Set monitored bot ID
     * @param {string|null} botId - Bot ID to monitor or null to clear
     */
    setMonitoredBotId(botId) {
        stateManager.monitoring.setMonitoredBotId(botId);
    }

    /**
     * Get monitored emojis
     * @returns {string[]} Array of monitored emojis
     */
    getMonitoredEmojis() {
        return stateManager.monitoring.getMonitoredEmojis();
    }

    /**
     * Set monitored emojis
     * @param {string[]} emojis - Array of emojis to monitor
     */
    setMonitoredEmojis(emojis) {
        stateManager.monitoring.setMonitoredEmojis(emojis);
    }

    /**
     * Add a monitored emoji
     * @param {string} emoji - Emoji to add
     */
    addMonitoredEmoji(emoji) {
        stateManager.monitoring.addMonitoredEmoji(emoji);
        Loggers.Bot.debug(`Added monitored emoji: ${emoji}`);
    }

    /**
     * Remove a monitored emoji
     * @param {string} emoji - Emoji to remove
     * @returns {boolean} Whether emoji was removed
     */
    removeMonitoredEmoji(emoji) {
        const removed = stateManager.monitoring.removeMonitoredEmoji(emoji);
        if (removed) {
            Loggers.Bot.debug(`Removed monitored emoji: ${emoji}`);
        }
        return removed;
    }

    /**
     * Get monitored channel ID
     * @returns {string|null} Monitored channel ID or null
     */
    getMonitoredChannelId() {
        return stateManager.monitoring.getMonitoredChannelId();
    }

    /**
     * Set monitored channel ID
     * @param {string|null} channelId - Channel ID to monitor or null to clear
     */
    setMonitoredChannelId(channelId) {
        stateManager.monitoring.setMonitoredChannelId(channelId);
    }

    /**
     * Start emoji monitoring
     * @param {string} channelId - Channel ID to monitor
     * @param {string} botId - Bot ID to monitor
     * @param {string[]} emojis - Emojis to monitor
     */
    startEmojiMonitoring(channelId, botId, emojis) {
        stateManager.startEmojiMonitoring(channelId, botId, emojis);
        Loggers.Bot.info(`Emoji monitoring started in channel ${channelId} for bot ${botId}`);
    }

    /**
     * Stop emoji monitoring
     */
    stopEmojiMonitoring() {
        stateManager.stopEmojiMonitoring();
        Loggers.Bot.info('Emoji monitoring stopped');
    }

    /**
     * Update emoji monitoring to new channel
     * @param {string} newChannelId - New channel ID
     */
    updateEmojiMonitoringChannel(newChannelId) {
        const currentChannelId = this.getMonitoredChannelId();

        if (newChannelId && newChannelId !== currentChannelId) {
            const botId = this.getMonitoredBotId() || this.config.defaultReactionId;
            const emojis = this.getMonitoredEmojis();

            if (emojis.length > 0) {
                this.startEmojiMonitoring(newChannelId, botId, emojis);
                Loggers.Bot.info(`Emoji monitoring updated to new channel: ${newChannelId}`);
            }
        }
    }

    // ============================================================================
    // TIMED CHANNELS
    // ============================================================================

    /**
     * Get timed channels
     * @returns {Object} Object of timed channels
     */
    getTimedChannels() {
        return stateManager.monitoring.getTimedChannels();
    }

    /**
     * Get a timed channel
     * @param {string} channelId - Channel ID
     * @returns {Object|null} Timed channel data or null
     */
    getTimedChannel(channelId) {
        return stateManager.monitoring.getTimedChannel(channelId);
    }

    /**
     * Set a timed channel
     * @param {string} channelId - Channel ID
     * @param {Object} data - Timed channel data
     */
    setTimedChannel(channelId, data) {
        stateManager.monitoring.setTimedChannel(channelId, data);
    }

    /**
     * Remove a timed channel
     * @param {string} channelId - Channel ID
     * @returns {boolean} Whether channel was removed
     */
    removeTimedChannel(channelId) {
        const removed = stateManager.monitoring.removeTimedChannel(channelId);
        if (removed) {
            Loggers.Bot.debug(`Removed timed channel: ${channelId}`);
        }
        return removed;
    }

    /**
     * Clear all timed channels
     */
    clearTimedChannels() {
        stateManager.monitoring.clearTimedChannels();
        Loggers.Bot.debug('All timed channels cleared');
    }

    // ============================================================================
    // ACTIVE TIMED FARM
    // ============================================================================

    /**
     * Get active timed farm
     * @returns {Object} Active timed farm data
     */
    getActiveTimedFarm() {
        return stateManager.monitoring.getActiveTimedFarm();
    }

    /**
     * Set active timed farm
     * @param {Object} data - Active timed farm data
     */
    setActiveTimedFarm(data) {
        stateManager.monitoring.setActiveTimedFarm(data);
    }

    /**
     * Clear active timed farm
     */
    clearActiveTimedFarm() {
        stateManager.monitoring.clearActiveTimedFarm();
        Loggers.Bot.debug('Active timed farm cleared');
    }

    /**
     * Check if has active timed farm
     * @returns {boolean} Whether has active timed farm
     */
    hasActiveTimedFarm() {
        return stateManager.monitoring.hasActiveTimedFarm();
    }

    /**
     * Start timed farm
     * @param {string} channelId - Channel ID
     * @param {number} duration - Duration in milliseconds
     * @param {Function} onEnd - Callback when farm ends
     * @returns {Timeout} The timeout for the timed farm
     */
    startTimedFarm(channelId, duration, onEnd) {
        // Clear existing timed farm
        this.clearActiveTimedFarm();

        const startTime = Date.now();
        const timeoutId = setTimeout(() => {
            try {
                onEnd();
                Loggers.Bot.info(`Timed farm ended for channel ${channelId}`);
            } catch (error) {
                Loggers.Bot.error(`Error in timed farm end callback: ${error.message}`);
            }
            this.clearActiveTimedFarm();
        }, duration);

        this.setActiveTimedFarm({
            channelId,
            startTime,
            timeoutId
        });

        Loggers.Bot.info(`Started timed farm for channel ${channelId} (duration: ${duration}ms)`);
        return timeoutId;
    }

    /**
     * Get monitoring statistics
     * @returns {Object} Monitoring statistics
     */
    getStats() {
        return {
            channelMonitoring: this.isMonitoring(),
            emojiMonitoring: this.isEmojiMonitoringEnabled(),
            monitoredBotId: this.getMonitoredBotId(),
            monitoredChannelId: this.getMonitoredChannelId(),
            monitoredEmojisCount: this.getMonitoredEmojis().length,
            timedChannelsCount: Object.keys(this.getTimedChannels()).length,
            hasActiveTimedFarm: this.hasActiveTimedFarm(),
            activeTimedFarm: this.getActiveTimedFarm()
        };
    }

    /**
     * Reset monitoring state
     */
    reset() {
        stateManager.monitoring.reset();
        Loggers.Bot.info('Monitoring state reset');
    }
}

// ============================================================================
// GLOBAL MONITORING SERVICE INSTANCE
// ============================================================================

/**
 * Global monitoring service instance
 * @type {MonitoringService}
 */
const monitoringService = new MonitoringService();

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    MonitoringService,
    monitoringService
};
