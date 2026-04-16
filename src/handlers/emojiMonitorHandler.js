/**
 * Emoji Monitoring Handler Module
 *
 * Monitors messages from a specific bot in a channel and detects
 * specified emojis. When found, sends a notification to the selfbot
 * via DM.
 *
 * @module handlers/emojiMonitorHandler
 */

const { botState, isEmojiMonitoringEnabled } = require('../core/state');
const { Loggers } = require('../utils/logger');

/**
 * Handle emoji monitoring for messages
 *
 * Checks if the message contains "OwO" and has any of the specified emojis.
 * If found, sends a DM notification.
 *
 * @param {Client} client - Discord client instance
 * @param {Message} message - Message to check
 */
async function handleEmojiMonitoring(client, message) {
    // Check if emoji monitoring is enabled
    if (!isEmojiMonitoringEnabled()) {
        return;
    }

    // Check if message is in the monitored channel
    if (message.channel.id !== botState.monitoredChannelId) {
        return;
    }

    // Skip own messages
    if (message.author.id === client.user.id) {
        return;
    }

    // Check if message contains "OwO" (case-insensitive)
    if (!message.content.toLowerCase().includes('owo')) {
        return;
    }

    Loggers.Bot.debug(`Emoji monitoring: Checking OwO message in channel ${message.channel.id}`);

    // Check for monitored emojis in the message
    const foundEmojis = [];

    // Check reactions
    message.reactions.cache.forEach((reaction, emoji) => {
        const emojiStr = reaction.emoji.toString();
        if (botState.monitoredEmojis.includes(emojiStr)) {
            foundEmojis.push({
                type: 'reaction',
                emoji: emojiStr,
                count: reaction.count
            });
        }
    });

    // Check message content for emojis
    const emojiRegex = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu;
    const contentEmojis = message.content.match(emojiRegex);
    if (contentEmojis) {
        contentEmojis.forEach(emoji => {
            if (botState.monitoredEmojis.includes(emoji)) {
                foundEmojis.push({
                    type: 'content',
                    emoji: emoji
                });
            }
        });
    }

    // Check message components (buttons) for emojis
    if (message.components && message.components.length > 0) {
        message.components.forEach(row => {
            if (row.components && row.components.length > 0) {
                row.components.forEach(component => {
                    if (component.emoji) {
                        const emojiStr = component.emoji.toString();
                        if (botState.monitoredEmojis.includes(emojiStr)) {
                            foundEmojis.push({
                                type: 'button',
                                emoji: emojiStr,
                                label: component.label,
                                customId: component.customId
                            });
                        }
                    }
                });
            }
        });
    }

    // If any monitored emojis were found, send DM notification
    if (foundEmojis.length > 0) {
        Loggers.Bot.info(`Found ${foundEmojis.length} monitored emoji(s) in OwO message`);

        try {
            // Send DM to the user
            const dmChannel = await client.users.createDM(client.user.id);

            let dmMessage = `🎯 **OwO Emoji Detected**\n\n`;
            dmMessage += `**Channel:** ${message.channel.name} (${message.channel.id})\n`;
            dmMessage += `**Message:** ${message.content.substring(0, 100)}${message.content.length > 100 ? '...' : ''}\n\n`;
            dmMessage += `**Found Emojis:**\n`;

            foundEmojis.forEach((found, index) => {
                dmMessage += `${index + 1}. ${found.emoji} (${found.type})`;
                if (found.count) dmMessage += ` - Count: ${found.count}`;
                if (found.label) dmMessage += ` - Button: ${found.label}`;
                dmMessage += `\n`;
            });

            dmMessage += `\n**Message Link:** https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.id}`;

            await dmChannel.send(dmMessage);
            Loggers.Bot.info(`DM notification sent for OwO emoji detection`);

        } catch (error) {
            Loggers.Bot.error(`Failed to send DM notification: ${error.message}`);
        }
    }
}

module.exports = {
    handleEmojiMonitoring
};
