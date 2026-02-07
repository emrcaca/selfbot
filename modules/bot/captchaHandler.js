const {
    MessageFlags,
    TextDisplayBuilder,
    SeparatorBuilder
} = require('discord.js');

const CAPTCHA_MESSAGE_TIMEOUT = 10 * 60 * 1000; // 10 minutes

/**
 * Send channel monitor alert
 * @param {Client} client - Discord client
 * @param {Object} messageData - Message data
 * @returns {Promise<void>}
 */
async function sendChannelMonitorAlert(client, messageData) {
    const { userId, author, channelId, content } = messageData;

    try {
        const user = await client.users.fetch(userId);
        const dmChannel = await user.createDM();

        const alertText = new TextDisplayBuilder().setContent(
            `⚠️ **Farm Kanalı Uyarısı**\n\n` +
            `**Kullanıcı:** ${author || '-'}\n` +
            `**Kanal ID:** ${channelId || '-'}\n` +
            `**Mesaj:** ${content || '-'}\n\n` +
            `Lütfen uyarıyı gözden geçirin.`
        );
        const separator = new SeparatorBuilder().setSpacing('Small');

        await dmChannel.send({
            components: [alertText, separator],
            flags: MessageFlags.IsComponentsV2
        });
    } catch (error) {
        console.error('Error sending channel monitor alert:', error);
    }
}

/**
 * Handle CAPTCHA notification
 * @param {Client} client - Discord client
 * @param {Object} msgData - Message data
 * @param {Map} captchaDmMessages - CAPTCHA DM messages map
 * @returns {Promise<void>}
 */
async function handleCaptchaNotification(client, msgData, captchaDmMessages) {
    const { userId, messageId, channelId, guildId } = msgData;

    try {
        const user = await client.users.fetch(userId);
        const dmChannel = await user.createDM();

        let originalMsg = null;
        if (messageId && channelId && guildId) {
            const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
            if (guild) {
                const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
                if (channel) {
                    originalMsg = await channel.messages.fetch(messageId).catch(() => null);
                }
            }
        }

        let sentMessage = null;
        if (originalMsg) {
            try {
                sentMessage = await originalMsg.forward(dmChannel);
            } catch (forwardError) {
                sentMessage = await sendFallbackMessage(dmChannel, '*Orijinal mesaj forward edilemedi.*');
            }
        } else {
            sentMessage = await sendFallbackMessage(dmChannel, '*Orijinal mesaj bilgileri eksik.*');
        }

        if (sentMessage) {
            setAutoDeleteTimer(sentMessage.id, userId, dmChannel, captchaDmMessages);
        }
    } catch (error) {
        console.error('Error handling CAPTCHA notification:', error);
    }
}

/**
 * Send fallback CAPTCHA message
 * @param {DMChannel} dmChannel - DM channel
 * @param {string} reason - Reason for fallback
 * @returns {Promise<Message>} Sent message
 */
async function sendFallbackMessage(dmChannel, reason) {
    const textDisplay = new TextDisplayBuilder().setContent(
        `⚠️ **CAPTCHA Tespit Edildi**\n\nCAPTCHA tespit edildi! Lütfen CAPTCHA\'yı manuel olarak çözün.\n\n${reason}`
    );
    const separator = new SeparatorBuilder().setSpacing('Small');

    return await dmChannel.send({
        components: [textDisplay, separator],
        flags: MessageFlags.IsComponentsV2
    });
}

/**
 * Set auto-delete timer for CAPTCHA message
 * @param {string} messageId - Message ID
 * @param {string} userId - User ID
 * @param {DMChannel} dmChannel - DM channel
 * @param {Map} captchaDmMessages - CAPTCHA DM messages map
 * @returns {void}
 */
function setAutoDeleteTimer(messageId, userId, dmChannel, captchaDmMessages) {
    const timeoutId = setTimeout(async () => {
        try {
            const stored = captchaDmMessages.get(userId);
            if (stored && stored.messageId === messageId) {
                await dmChannel.messages.delete(messageId);
                captchaDmMessages.delete(userId);
            }
        } catch (error) {
            console.error('Error auto-deleting CAPTCHA message:', error);
        }
    }, CAPTCHA_MESSAGE_TIMEOUT);

    captchaDmMessages.set(userId, { messageId, timeoutId });
}

/**
 * Handle CAPTCHA solved
 * @param {Client} client - Discord client
 * @param {string} userId - User ID
 * @param {Map} captchaDmMessages - CAPTCHA DM messages map
 * @returns {Promise<void>}
 */
async function handleCaptchaSolved(client, userId, captchaDmMessages) {
    const stored = captchaDmMessages.get(userId);

    if (!stored) {
        return;
    }

    try {
        if (stored.timeoutId) {
            clearTimeout(stored.timeoutId);
        }

        const user = await client.users.fetch(userId);
        const dmChannel = await user.createDM();
        await dmChannel.messages.delete(stored.messageId);
    } catch (error) {
        console.error('Error handling CAPTCHA solved:', error);
    } finally {
        captchaDmMessages.delete(userId);
    }
}

/**
 * Cleanup old alert messages for user
 * @param {Client} client - Discord client
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
async function cleanupOldAlertMessagesForUser(client, userId) {
    try {
        const user = await client.users.fetch(userId);
        const dmChannel = await user.createDM();
        const messages = await dmChannel.messages.fetch({ limit: 50 });

        for (const [id, msg] of messages) {
            if (msg.author.id === client.user.id && msg.content.includes('Farm kanalına birisi yazdı')) {
                await msg.delete().catch(err => {
                    console.error('Error deleting old alert message:', err);
                });
            }
        }
    } catch (error) {
        console.error('Error cleaning up old alert messages:', error);
    }
}

module.exports = {
    sendChannelMonitorAlert,
    handleCaptchaNotification,
    handleCaptchaSolved,
    cleanupOldAlertMessagesForUser
};