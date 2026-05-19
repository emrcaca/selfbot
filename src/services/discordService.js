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

// ============================================================================
// CONSTANTS
// ============================================================================

const CACHE_TTL = 5 * 60 * 1000;
const MESSAGE_QUEUE_DELAY = 1100;
const MESSAGE_QUEUE_INITIAL_DELAY = 100;

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

const channelCache = new Map();

function cleanExpiredCache() {
    const now = Date.now();
    for (const [key, value] of channelCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
            channelCache.delete(key);
        }
    }
}

async function getChannel(client, channelId) {
    if (!channelId) return null;

    const cached = channelCache.get(channelId);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        return cached.channel;
    }

    cleanExpiredCache();

    try {
        const channel = client.channels.cache.get(channelId) || await client.channels.fetch(channelId);
        if (channel) {
            channelCache.set(channelId, { channel, timestamp: Date.now() });
        }
        return channel;
    } catch {
        return null;
    }
}

function clearAllCaches() {
    channelCache.clear();
}

// ============================================================================
// DISCORD INTERACTIONS
// ============================================================================

async function sendTyping(client, channelId, messageContent = '') {
    if (Math.random() >= PROBABILITIES.TYPING) return;

    const channel = await getChannel(client, channelId);
    if (channel?.isText() && channel.type !== 'GUILD_FORUM') {
        try {
            await channel.sendTyping();
            
            // Eğer içerik belirtilmemişse varsayılan rastgele bekleme kullan
            if (!messageContent) {
                await delay(getRandomInt(200, 1000));
                return;
            }

            // Karakter uzunluğuna göre bekleme süresi hesaplama
            const charCount = messageContent.length;
            
            // Her karakter için rastgele bir yazma hızı (80ms - 150ms arası)
            let totalTypingTime = 0;
            for (let i = 0; i < charCount; i++) {
                totalTypingTime += getRandomInt(80, 150);
            }

            // "Enter" tuşuna basma reaksiyon süresi (150ms - 350ms arası rastgele ek gecikme)
            const reactionTime = getRandomInt(150, 350);
            
            const finalDelay = totalTypingTime + reactionTime;
            await delay(finalDelay);
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

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    getChannel,
    sendTyping,
    sendMessage,
    clearAllCaches
};