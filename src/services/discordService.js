/**
 * Discord Service Module
 *
 * Handles Discord API interactions including:
 * - Rate limiting and message queuing
 * - Channel and user caching
 * - Typing indicators
 * - Message sending
 * - Timeout tracking
 *
 * @module services/discordService
 */

const { botState, DELAYS, PROBABILITIES } = require('../core/state');
const { getRandomInt, delay } = require('../utils/helpers');
const { logError } = require('../utils/errorHandler');

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum requests per second for Discord API */
const DISCORD_API_RATE_LIMIT = 5;

/** Maximum messages per second per channel */
const DISCORD_MESSAGE_RATE_LIMIT = 1;

/** Cache time-to-live in milliseconds */
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/** Message queue processing delay (ms) */
const MESSAGE_QUEUE_DELAY = 1100;

/** Initial message queue delay (ms) */
const MESSAGE_QUEUE_INITIAL_DELAY = 100;

// ============================================================================
// RATE LIMITING
// ============================================================================

/** Discord API request queue */
const discordApiQueue = [];

/** Per-channel message queues */
const discordMessageQueue = new Map();

/** Timeout for API queue processing */
let discordApiRateLimitTimeout = null;

/**
 * Process Discord API request queue
 *
 * Processes up to the rate limit number of requests from the queue
 * and schedules the next batch.
 */
function processDiscordApiQueue() {
    if (discordApiQueue.length === 0) {
        discordApiRateLimitTimeout = null;
        return;
    }

    const availableSlots = DISCORD_API_RATE_LIMIT;

    // Process up to available slots
    for (let i = 0; i < Math.min(availableSlots, discordApiQueue.length); i++) {
        const request = discordApiQueue.shift();
        request.fn();
    }

    // Schedule next batch
    discordApiRateLimitTimeout = setTimeout(processDiscordApiQueue, 1000);
}

/**
 * Add a request to the Discord API queue
 *
 * Queues a request for execution, respecting rate limits.
 *
 * @param {Function} fn - Function to execute
 */
function addToDiscordApiQueue(fn) {
    discordApiQueue.push({ fn, timestamp: Date.now() });

    // Start processing if not already started
    if (!discordApiRateLimitTimeout) {
        processDiscordApiQueue();
    }
}

/**
 * Process message queue for a specific channel
 *
 * Processes one message from the queue and schedules the next
 * if there are more messages pending.
 *
 * @param {string} channelId - Channel ID
 */
function processChannelMessageQueue(channelId) {
    const queue = discordMessageQueue.get(channelId);

    if (!queue || queue.length === 0) {
        discordMessageQueue.delete(channelId);
        return;
    }

    const request = queue.shift();
    request.fn();

    // Schedule next message if more are pending
    if (queue.length > 0) {
        setTimeout(() => processChannelMessageQueue(channelId), MESSAGE_QUEUE_DELAY);
    } else {
        discordMessageQueue.delete(channelId);
    }
}

/**
 * Add a message request to the per-channel queue
 *
 * Queues a message for delivery to a specific channel, respecting
 * per-channel rate limits.
 *
 * @param {string} channelId - Channel ID
 * @param {Function} fn - Function to execute
 */
function addToMessageQueue(channelId, fn) {
    if (!discordMessageQueue.has(channelId)) {
        discordMessageQueue.set(channelId, []);
        // Start processing immediately for new queue
        setTimeout(() => processChannelMessageQueue(channelId), MESSAGE_QUEUE_INITIAL_DELAY);
    }

    discordMessageQueue.get(channelId).push({ fn, timestamp: Date.now() });
}

// ============================================================================
// TIMEOUT TRACKING
// ============================================================================

/** Set of active timeout IDs for memory leak prevention */
const activeTimeouts = new Set();

/**
 * Set a timeout with tracking to prevent memory leaks
 *
 * Creates a timeout that is tracked and can be cleared properly
 * to prevent memory leaks.
 *
 * @param {Function} callback - Function to execute after delay
 * @param {number} delayMs - Delay in milliseconds
 * @returns {Object} Timeout object with cancel method
 */
function setTrackedTimeout(callback, delayMs) {
    const timeoutId = setTimeout(() => {
        try {
            callback();
        } catch (error) {
            logError('TRACKED_TIMEOUT', error);
        } finally {
            activeTimeouts.delete(timeoutId);
        }
    }, delayMs);

    activeTimeouts.add(timeoutId);

    return {
        id: timeoutId,
        cancel: () => {
            clearTimeout(timeoutId);
            activeTimeouts.delete(timeoutId);
        }
    };
}

/**
 * Clear all tracked timeouts
 *
 * Clears all tracked timeouts to prevent memory leaks during shutdown.
 */
function clearAllTrackedTimeouts() {
    for (const timeoutId of activeTimeouts) {
        clearTimeout(timeoutId);
    }
    activeTimeouts.clear();
}

// ============================================================================
// CACHING
// ============================================================================

/** Cache for channels to reduce API calls */
const channelCache = new Map();

/** Cache for users to reduce API calls */
const userCache = new Map();

/**
 * Clean expired cache entries
 *
 * Removes entries from the cache that have exceeded their TTL.
 *
 * @param {Map} cache - Cache map to clean
 */
function cleanExpiredCache(cache) {
    const now = Date.now();

    for (const [key, value] of cache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
            cache.delete(key);
        }
    }
}

/**
 * Get a channel by ID with caching
 *
 * Retrieves a channel from cache or fetches it from Discord API.
 *
 * @param {Client} client - Discord client instance
 * @param {string} channelId - Channel ID
 * @returns {Promise<Channel|null>} Channel object or null if not found
 */
async function getChannel(client, channelId) {
    if (!channelId) {
        return null;
    }

    // Check cache first
    const cached = channelCache.get(channelId);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        return cached.channel;
    }

    // Clean expired entries
    cleanExpiredCache(channelCache);

    try {
        // Try cache first, then fetch if not found
        const channel = client.channels.cache.get(channelId) || await client.channels.fetch(channelId);

        if (channel) {
            // Cache the channel
            channelCache.set(channelId, {
                channel,
                timestamp: Date.now()
            });
        }

        return channel;
    } catch (error) {
        logError('DISCORD_GET_CHANNEL', error);
        return null;
    }
}

/**
 * Get a user by ID with caching
 *
 * Retrieves a user from cache or fetches it from Discord API.
 *
 * @param {Client} client - Discord client instance
 * @param {string} userId - User ID
 * @returns {Promise<User|null>} User object or null if not found
 */
async function getUser(client, userId) {
    if (!userId) {
        return null;
    }

    // Check cache first
    const cached = userCache.get(userId);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        return cached.user;
    }

    // Clean expired entries
    cleanExpiredCache(userCache);

    try {
        // Try cache first, then fetch if not found
        const user = client.users.cache.get(userId) || await client.users.fetch(userId);

        if (user) {
            // Cache the user
            userCache.set(userId, {
                user,
                timestamp: Date.now()
            });
        }

        return user;
    } catch (error) {
        logError('DISCORD_GET_USER', error);
        return null;
    }
}

/**
 * Clear all caches
 *
 * Clears both channel and user caches.
 */
function clearAllCaches() {
    channelCache.clear();
    userCache.clear();
}

/**
 * Get cache statistics
 *
 * Returns statistics about the current cache state.
 *
 * @returns {Object} Cache statistics
 */
function getCacheStats() {
    return {
        channels: channelCache.size,
        users: userCache.size,
        ttl: CACHE_TTL
    };
}

// ============================================================================
// DISCORD INTERACTIONS
// ============================================================================

/**
 * Send typing indicator to a channel
 *
 * Sends a typing indicator to make the bot appear more natural.
 * Only sends based on the TYPING probability setting.
 *
 * @param {Client} client - Discord client instance
 * @param {string} channelId - Channel ID
 * @returns {Promise<void>}
 */
async function sendTyping(client, channelId) {
    // Only send typing indicator based on probability
    if (Math.random() >= PROBABILITIES.TYPING) {
        return;
    }

    const channel = await getChannel(client, channelId);

    if (channel?.isText() && channel.type !== 'GUILD_FORUM') {
        try {
            await channel.sendTyping();
            await delay(getRandomInt(DELAYS.TYPING.MIN, DELAYS.TYPING.MAX));
        } catch (error) {
            // Silently handle typing errors
            // Typing indicators are optional and not critical
        }
    }
}

/**
 * Send a message to a channel
 *
 * Sends a message to a Discord channel with rate limiting.
 * Uses the message queue to respect per-channel rate limits.
 *
 * @param {Client} client - Discord client instance
 * @param {string} channelId - Channel ID
 * @param {string} messageContent - Message content
 * @returns {Promise<Message|null>} Sent message or null if failed
 */
async function sendMessage(client, channelId, messageContent) {
    const channel = await getChannel(client, channelId);

    if (!channel?.isText()) {
        return null;
    }

    return new Promise((resolve) => {
        addToMessageQueue(channelId, async () => {
            try {
                await delay(getRandomInt(DELAYS.MESSAGE.MIN, DELAYS.MESSAGE.MAX));
                const sentMessage = await channel.send(messageContent);
                resolve(sentMessage);
            } catch (error) {
                logError('DISCORD_SEND_MESSAGE', error);
                resolve(null);
            }
        });
    });
}

/**
 * Send an embed to a channel
 *
 * Sends an embed message to a Discord channel.
 *
 * @param {Client} client - Discord client instance
 * @param {string} channelId - Channel ID
 * @param {Object} embedData - Embed data
 * @returns {Promise<Message|null>} Sent message or null if failed
 */
async function sendEmbed(client, channelId, embedData) {
    const channel = await getChannel(client, channelId);

    if (!channel?.isText()) {
        return null;
    }

    return new Promise((resolve) => {
        addToMessageQueue(channelId, async () => {
            try {
                await delay(getRandomInt(DELAYS.MESSAGE.MIN, DELAYS.MESSAGE.MAX));
                const sentMessage = await channel.send({ embeds: [embedData] });
                resolve(sentMessage);
            } catch (error) {
                logError('DISCORD_SEND_EMBED', error);
                resolve(null);
            }
        });
    });
}

/**
 * Delete a message
 *
 * Deletes a message from a channel.
 *
 * @param {Client} client - Discord client instance
 * @param {string} channelId - Channel ID
 * @param {string} messageId - Message ID
 * @returns {Promise<boolean>} True if deleted successfully
 */
async function deleteMessage(client, channelId, messageId) {
    const channel = await getChannel(client, channelId);

    if (!channel?.isText()) {
        return false;
    }

    try {
        const message = await channel.messages.fetch(messageId);
        await message.delete();
        return true;
    } catch (error) {
        logError('DISCORD_DELETE_MESSAGE', error);
        return false;
    }
}

// ============================================================================
// QUEUE MANAGEMENT
// ============================================================================

/**
 * Get queue statistics
 *
 * Returns statistics about the current queue state.
 *
 * @returns {Object} Queue statistics
 */
function getQueueStats() {
    const channelQueues = {};

    for (const [channelId, queue] of discordMessageQueue.entries()) {
        channelQueues[channelId] = queue.length;
    }

    return {
        apiQueue: discordApiQueue.length,
        messageQueues: channelQueues,
        totalPendingMessages: discordMessageQueue.size
    };
}

/**
 * Clear all queues
 *
 * Clears all pending requests from the queues.
 */
function clearAllQueues() {
    discordApiQueue.length = 0;
    discordMessageQueue.clear();

    if (discordApiRateLimitTimeout) {
        clearTimeout(discordApiRateLimitTimeout);
        discordApiRateLimitTimeout = null;
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    // Discord interactions
    getChannel,
    getUser,
    sendTyping,
    sendMessage,
    sendEmbed,
    deleteMessage,

    // Timeout tracking
    setTrackedTimeout,
    clearAllTrackedTimeouts,

    // Caching
    clearAllCaches,
    getCacheStats,

    // Queue management
    getQueueStats,
    clearAllQueues
};