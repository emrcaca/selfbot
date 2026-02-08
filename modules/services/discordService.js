const { botState, DELAYS, PROBABILITIES } = require('../core/state');
const { getRandomInt, delay } = require('../utils/helpers');
const { logError } = require('../utils/errorHandler');

// Discord API rate limiting
const DISCORD_API_RATE_LIMIT = 5; // Max requests per second for general API calls
const DISCORD_MESSAGE_RATE_LIMIT = 1; // Max messages per second per channel
const discordApiQueue = [];
const discordMessageQueue = new Map(); // Per-channel message queues
let discordApiRateLimitTimeout = null;

// Timeout tracking to prevent memory leaks
const activeTimeouts = new Set();

// Cache for channels and users to reduce API calls
const channelCache = new Map();
const userCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Process Discord API request queue
 * @returns {void}
 */
function processDiscordApiQueue() {
    if (discordApiQueue.length === 0) {
        discordApiRateLimitTimeout = null;
        return;
    }

    const now = Date.now();
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
 * @param {Function} fn - Function to execute
 * @returns {void}
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
 * @param {string} channelId - Channel ID
 * @returns {void}
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
        setTimeout(() => processChannelMessageQueue(channelId), 1100); // 1.1 second delay
    } else {
        discordMessageQueue.delete(channelId);
    }
}

/**
 * Add a message request to the per-channel queue
 * @param {string} channelId - Channel ID
 * @param {Function} fn - Function to execute
 * @returns {void}
 */
function addToMessageQueue(channelId, fn) {
    if (!discordMessageQueue.has(channelId)) {
        discordMessageQueue.set(channelId, []);
        // Start processing immediately for new queue
        setTimeout(() => processChannelMessageQueue(channelId), 100);
    }

    discordMessageQueue.get(channelId).push({ fn, timestamp: Date.now() });
}

/**
 * Set a timeout with tracking to prevent memory leaks
 * @param {Function} callback - Function to execute after delay
 * @param {number} delay - Delay in milliseconds
 * @returns {Object} Timeout object with cancel method
 */
function setTrackedTimeout(callback, delay) {
    const timeoutId = setTimeout(() => {
        try {
            callback();
        } catch (error) {
            logError('TRACKED_TIMEOUT', error);
        } finally {
            activeTimeouts.delete(timeoutId);
        }
    }, delay);

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
 * Clear all tracked timeouts to prevent memory leaks
 * @returns {void}
 */
function clearAllTrackedTimeouts() {
    for (const timeoutId of activeTimeouts) {
        clearTimeout(timeoutId);
    }
    activeTimeouts.clear();
}

/**
 * Clean expired cache entries
 * @param {Map} cache - Cache map to clean
 * @returns {void}
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
 * @param {Client} client - Discord client instance
 * @param {string} channelId - Channel ID
 * @returns {Promise<Channel|null>} Channel object or null if not found
 */
async function getChannel(client, channelId) {
    if (!channelId) return null;

    // Check cache first
    const cached = channelCache.get(channelId);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        return cached.channel;
    }

    // Clean expired entries
    cleanExpiredCache(channelCache);

    try {
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
        return null;
    }
}

/**
 * Send typing indicator to a channel
 * @param {Client} client - Discord client instance
 * @param {string} channelId - Channel ID
 * @returns {Promise<void>}
 */
async function sendTyping(client, channelId) {
    if (Math.random() >= PROBABILITIES.TYPING) return;
    const channel = await getChannel(client, channelId);
    if (channel?.isText() && channel.type !== 'GUILD_FORUM') {
        try {
            await channel.sendTyping();
            await delay(getRandomInt(DELAYS.TYPING.MIN, DELAYS.TYPING.MAX));
        } catch (error) {
            // Silently handle typing errors
        }
    }
}

/**
 * Send a message to a channel
 * @param {Client} client - Discord client instance
 * @param {string} channelId - Channel ID
 * @param {string} messageContent - Message content
 * @returns {Promise<Message|null>} Sent message or null if failed
 */
async function sendMessage(client, channelId, messageContent) {
    const channel = await getChannel(client, channelId);
    if (channel?.isText()) {
        return new Promise((resolve) => {
            addToMessageQueue(channelId, async () => {
                try {
                    await delay(getRandomInt(DELAYS.MESSAGE.MIN, DELAYS.MESSAGE.MAX));
                    const sentMessage = await channel.send(messageContent);
                    resolve(sentMessage);
                } catch (error) {
                    resolve(null);
                }
            });
        });
    }
    return null;
}

module.exports = {
    sendTyping,
    sendMessage,
    setTrackedTimeout,
    clearAllTrackedTimeouts
};
