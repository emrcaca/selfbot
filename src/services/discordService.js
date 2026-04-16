/**
 * Discord Service Module
 *
 * Handles Discord API interactions:
 * - Channel caching
 * - Typing indicators
 * - Message sending
 *
 * @module services/discordService
 */

const { PROBABILITIES } = require('../core/state');
const { getRandomInt, delay } = require('../utils/helpers');
const { globalResourceManager } = require('../utils/managers/resourceManager');
const { globalChannelCache } = require('../utils/cache/channelCache');
const { CACHE, FARMING } = require('../config/constants');

// ============================================================================
// CONSTANTS
// ============================================================================

// Using constants from config/constants.js
const CACHE_TTL = CACHE.CHANNEL_TTL;
const MESSAGE_QUEUE_DELAY = CACHE.MESSAGE_QUEUE_DELAY;
const MESSAGE_QUEUE_INITIAL_DELAY = CACHE.MESSAGE_QUEUE_INITIAL_DELAY;

// ============================================================================
// MESSAGE QUEUE
// ============================================================================

const discordMessageQueue = new Map();

function processChannelMessageQueue(channelId) {
    const queue = discordMessageQueue.get(channelId);
    if (!queue || queue.length === 0) {
        discordMessageQueue.delete(channelId);
        return;
    }
    const request = queue.shift();
    request.fn();
    if (queue.length > 0) {
        setTimeout(() => processChannelMessageQueue(channelId), MESSAGE_QUEUE_DELAY);
    } else {
        discordMessageQueue.delete(channelId);
    }
}

function addToMessageQueue(channelId, fn) {
    if (!discordMessageQueue.has(channelId)) {
        discordMessageQueue.set(channelId, []);
        setTimeout(() => processChannelMessageQueue(channelId), MESSAGE_QUEUE_INITIAL_DELAY);
    }
    discordMessageQueue.get(channelId).push({ fn, timestamp: Date.now() });
}

// ============================================================================
// CACHING
// ============================================================================

async function getChannel(client, channelId) {
    if (!channelId) return null;

    try {
        return await globalChannelCache.getOrFetchChannel(channelId, client);
    } catch {
        return null;
    }
}

function clearAllCaches() {
    globalChannelCache.clearChannels();
}

// ============================================================================
// DISCORD INTERACTIONS
// ============================================================================

async function sendTyping(client, channelId) {
    if (Math.random() >= PROBABILITIES.TYPING) return;

    const channel = await getChannel(client, channelId);
    if (channel?.isText() && channel.type !== 'GUILD_FORUM') {
        try {
            await channel.sendTyping();
            await delay(getRandomInt(200, 1000));
        } catch {}
    }
}

async function sendMessage(client, channelId, messageContent) {
    const channel = await getChannel(client, channelId);
    if (!channel?.isText()) return null;

    return new Promise((resolve) => {
        addToMessageQueue(channelId, async () => {
            try {
                await delay(getRandomInt(200, 500));
                const sentMessage = await channel.send(messageContent);
                resolve(sentMessage);
            } catch {
                resolve(null);
            }
        });
    });
}

function clearAllTrackedTimeouts() {
    // Clear all tracked resources using the resource manager
    globalResourceManager.clearAll();
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    getChannel,
    sendTyping,
    sendMessage,
    clearAllTrackedTimeouts,
    clearAllCaches
};