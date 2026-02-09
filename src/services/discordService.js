const { DELAYS, PROBABILITIES } = require('../core/state');
const { getRandomInt, delay } = require('../utils/helpers');
const { logError } = require('../utils/errorHandler');

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

class DiscordService {
    constructor() {
        // Caches
        this.channelCache = new Map();
        this.userCache = new Map();
        
        // Timeout tracking
        this.activeTimeouts = new Set();
        
        // Message Queue
        this.messageQueues = new Map(); // channelId -> Array<Task>
    }

    /**
     * Set a timeout that can be tracked and cleared
     * @param {Function} callback 
     * @param {number} ms 
     */
    setTrackedTimeout(callback, ms) {
        const timeoutId = setTimeout(() => {
            try {
                callback();
            } catch (error) {
                logError('TRACKED_TIMEOUT', error);
            } finally {
                this.activeTimeouts.delete(timeoutId);
            }
        }, ms);
        
        this.activeTimeouts.add(timeoutId);
        
        return {
            id: timeoutId,
            cancel: () => {
                clearTimeout(timeoutId);
                this.activeTimeouts.delete(timeoutId);
            }
        };
    }

    /**
     * Clear all pending timeouts
     */
    clearAllTrackedTimeouts() {
        for (const id of this.activeTimeouts) {
            clearTimeout(id);
        }
        this.activeTimeouts.clear();
    }

    /**
     * Clear all caches
     */
    clearAllCaches() {
        this.channelCache.clear();
        this.userCache.clear();
    }

    /**
     * Get a channel with caching
     */
    async getChannel(client, channelId) {
        if (!channelId) return null;

        const cached = this.channelCache.get(channelId);
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
            return cached.data;
        }

        try {
            const channel = client.channels.cache.get(channelId) || await client.channels.fetch(channelId);
            if (channel) {
                this.channelCache.set(channelId, { data: channel, timestamp: Date.now() });
            }
            return channel;
        } catch (error) {
            return null;
        }
    }

    /**
     * Queue a message to be sent to a channel
     * enforces 1 message per ~1.1s per channel
     */
    async sendMessage(client, channelId, content) {
        const channel = await this.getChannel(client, channelId);
        if (!channel?.isText()) return null;

        return new Promise((resolve) => {
            if (!this.messageQueues.has(channelId)) {
                this.messageQueues.set(channelId, []);
                // Start processing loop after pushing the task
                setTimeout(() => this._processQueue(channelId), 0);
            }

            this.messageQueues.get(channelId).push({
                fn: async () => {
                    try {
                        await delay(getRandomInt(DELAYS.MESSAGE.MIN, DELAYS.MESSAGE.MAX));
                        const msg = await channel.send(content);
                        resolve(msg);
                    } catch (e) {
                        resolve(null);
                    }
                }
            });
        });
    }

    /**
     * Process the message queue for a specific channel
     * @private
     */
    async _processQueue(channelId) {
        const queue = this.messageQueues.get(channelId);
        if (!queue || queue.length === 0) {
            this.messageQueues.delete(channelId);
            return;
        }

        const task = queue.shift();
        if (task) await task.fn();

        if (queue.length > 0) {
            // Schedule next message
            this.setTrackedTimeout(() => this._processQueue(channelId), 1100);
        } else {
            this.messageQueues.delete(channelId);
        }
    }

    /**
     * Send typing indicator
     */
    async sendTyping(client, channelId) {
        if (Math.random() >= PROBABILITIES.TYPING) return;

        const channel = await this.getChannel(client, channelId);
        if (channel?.isText() && channel.type !== 'GUILD_FORUM') {
            try {
                await channel.sendTyping();
                await delay(getRandomInt(DELAYS.TYPING.MIN, DELAYS.TYPING.MAX));
            } catch (e) {
                // Ignore typing errors
            }
        }
    }
}

// Export singleton instance
const service = new DiscordService();

// Bind methods for easy destructuring
module.exports = {
    getChannel: service.getChannel.bind(service),
    sendMessage: service.sendMessage.bind(service),
    sendTyping: service.sendTyping.bind(service),
    setTrackedTimeout: service.setTrackedTimeout.bind(service),
    clearAllTrackedTimeouts: service.clearAllTrackedTimeouts.bind(service),
    clearAllCaches: service.clearAllCaches.bind(service)
};
