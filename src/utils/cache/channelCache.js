/**
 * Channel Cache Module
 *
 * Specialized cache for Discord channels with automatic cleanup
 * and Discord-specific optimizations.
 *
 * @module utils/cache/channelCache
 */

const { CacheManager } = require('./cacheManager');
const { CACHE } = require('../../config/constants');

// ============================================================================
// CHANNEL CACHE CLASS
// ============================================================================

/**
 * Channel Cache
 *
 * Specialized cache for Discord channels with:
 * - Automatic TTL-based expiration
 * - Discord-specific optimizations
 * - Channel type filtering
 * - Permission checking
 */
class ChannelCache extends CacheManager {
    /**
     * @param {Object} options - Cache options
     */
    constructor(options = {}) {
        super({
            defaultTtl: options.defaultTtl || CACHE.CHANNEL_TTL,
            maxSize: options.maxSize || CACHE.MAX_CACHE_SIZE,
            evictionStrategy: options.evictionStrategy || 'lru',
            cleanupIntervalMs: options.cleanupIntervalMs || 60000
        });

        /** @type {Object} Cache configuration */
        this.config = {
            ttl: options.defaultTtl || CACHE.CHANNEL_TTL,
            maxSize: options.maxSize || CACHE.MAX_CACHE_SIZE
        };
    }

    /**
     * Get a channel from cache
     * @param {string} channelId - Channel ID
     * @returns {Object|null} Channel object or null
     */
    getChannel(channelId) {
        if (!channelId) {
            return null;
        }

        return this.get(channelId);
    }

    /**
     * Set a channel in cache
     * @param {string} channelId - Channel ID
     * @param {Object} channel - Channel object
     * @param {number} ttl - Time to live in milliseconds (optional)
     * @returns {boolean} Whether channel was cached
     */
    setChannel(channelId, channel, ttl = this.config.ttl) {
        if (!channelId || !channel) {
            return false;
        }

        return this.set(channelId, channel, ttl);
    }

    /**
     * Get or fetch a channel
     * @param {string} channelId - Channel ID
     * @param {Object} client - Discord client instance
     * @returns {Promise<Object|null>} Channel object or null
     */
    async getOrFetchChannel(channelId, client) {
        if (!channelId || !client) {
            return null;
        }

        // Try to get from cache first
        const cached = this.getChannel(channelId);
        if (cached) {
            return cached;
        }

        // Fetch from Discord
        try {
            const channel = client.channels.cache.get(channelId) ||
                           await client.channels.fetch(channelId);

            if (channel) {
                this.setChannel(channelId, channel);
            }

            return channel;
        } catch (error) {
            return null;
        }
    }

    /**
     * Check if channel is cached and valid
     * @param {string} channelId - Channel ID
     * @returns {boolean} Whether channel is cached and valid
     */
    hasChannel(channelId) {
        return this.has(channelId);
    }

    /**
     * Remove a channel from cache
     * @param {string} channelId - Channel ID
     * @returns {boolean} Whether channel was removed
     */
    removeChannel(channelId) {
        return this.delete(channelId);
    }

    /**
     * Clear all channels from cache
     */
    clearChannels() {
        this.clear();
    }

    /**
     * Get all cached channel IDs
     * @returns {string[]} Array of channel IDs
     */
    getChannelIds() {
        return this.keys();
    }

    /**
     * Get all cached channels
     * @returns {Array} Array of channel objects
     */
    getAllChannels() {
        return this.values();
    }

    /**
     * Get channels by type
     * @param {string} type - Channel type (e.g., 'GUILD_TEXT', 'GUILD_VOICE')
     * @returns {Array} Array of channels of the specified type
     */
    getChannelsByType(type) {
        return this.values().filter(channel => channel.type === type);
    }

    /**
     * Get text channels
     * @returns {Array} Array of text channels
     */
    getTextChannels() {
        return this.values().filter(channel => channel.isText && channel.isText());
    }

    /**
     * Get voice channels
     * @returns {Array} Array of voice channels
     */
    getVoiceChannels() {
        return this.values().filter(channel => channel.type === 'GUILD_VOICE');
    }

    /**
     * Get channel statistics
     * @returns {Object} Channel cache statistics
     */
    getChannelStats() {
        const stats = this.getStats();
        const channels = this.getAllChannels();

        return {
            ...stats,
            textChannels: channels.filter(c => c.isText && c.isText()).length,
            voiceChannels: channels.filter(c => c.type === 'GUILD_VOICE').length,
            otherChannels: channels.length -
                channels.filter(c => c.isText && c.isText()).length -
                channels.filter(c => c.type === 'GUILD_VOICE').length
        };
    }

    /**
     * Invalidate channels by pattern
     * @param {RegExp} pattern - Pattern to match channel IDs
     * @returns {number} Number of channels invalidated
     */
    invalidateByPattern(pattern) {
        const keys = this.getChannelIds();
        const toDelete = keys.filter(key => pattern.test(key));

        return this.deleteMany(toDelete);
    }

    /**
     * Prune expired channels
     * @returns {number} Number of channels pruned
     */
    pruneExpired() {
        return this.cleanup();
    }

    /**
     * Get cache hit rate for channels
     * @returns {number} Hit rate as percentage
     */
    getHitRate() {
        const stats = this.getStats();
        return parseFloat(stats.hitRate);
    }

    /**
     * Check if cache is healthy
     * @returns {boolean} Whether cache is healthy
     */
    isHealthy() {
        const stats = this.getStats();
        return stats.size < stats.maxSize && this.getHitRate() > 50;
    }
}

// ============================================================================
// GLOBAL CHANNEL CACHE INSTANCE
// ============================================================================

/**
 * Global channel cache instance
 * @type {ChannelCache}
 */
const globalChannelCache = new ChannelCache();

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    ChannelCache,
    globalChannelCache
};
