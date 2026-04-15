/**
 * Giveaway Handler Module
 *
 * Automatically joins giveaways by:
 * - Clicking buttons with 🎉 emoji
 * - Reacting with 🎊 emoji
 *
 * @module handlers/giveawayHandler
 */

const { Loggers } = require('../utils/logger');

const DELAY_MS = 5000;

/**
 * Check if the bot has access to a channel
 */
async function hasChannelAccess(channel, client) {
    try {
        // Check if channel is a text channel
        if (!channel.isText()) {
            Loggers.Bot.debug(`Channel ${channel.id} is not a text channel`);
            return false;
        }

        // Get member in the guild
        const member = channel.guild?.members.me || await channel.guild?.members.fetch(client.user.id).catch(() => null);
        if (!member) {
            Loggers.Bot.debug(`Could not fetch member for user ${client.user.id} in guild ${channel.guild?.id}`);
            return false;
        }

        // Check ViewChannel permission
        if (!channel.permissionsFor(member).has('ViewChannel')) {
            Loggers.Bot.debug(`No ViewChannel permission in channel ${channel.id}`);
            return false;
        }

        // Check SendMessages permission (needed for clicking buttons)
        if (!channel.permissionsFor(member).has('SendMessages')) {
            Loggers.Bot.debug(`No SendMessages permission in channel ${channel.id}`);
            return false;
        }

        return true;
    } catch (err) {
        Loggers.Bot.error(`Error checking channel access: ${err.message}`);
        return false;
    }
}

async function handleGiveawayMessage(message, channelIds, client) {
    if (!channelIds || channelIds.length === 0) return;
    if (!channelIds.includes(message.channel.id)) return;
    if (!message.author.bot) return;
    if (message.author.id === message.client.user?.id) return;

    // Check channel access
    const hasAccess = await hasChannelAccess(message.channel, message.client);
    if (!hasAccess) {
        return;
    }

    Loggers.Bot.debug(`Giveaway message detected in channel ${message.channel.id} from bot ${message.author.username}`);

    const channel = message.channel;
    if (!channel.isText()) {
        Loggers.Bot.debug(`Channel ${message.channel.id} is not a text channel`);
        return;
    }

    const me = channel.guild?.members.me || await channel.guild?.members.fetch(message.client.user.id).catch(() => null);
    if (!me) {
        Loggers.Bot.debug(`Could not fetch member for user ${message.client.user.id}`);
        return;
    }
    if (!channel.permissionsFor(me).has('ViewChannel')) {
        Loggers.Bot.debug(`No ViewChannel permission in ${message.channel.id}`);
        return;
    }

    // Log components for debugging
    if (message.components && message.components.length > 0) {
        Loggers.Bot.debug(`Message has ${message.components.length} component row(s)`);
        message.components.forEach((row, rowIndex) => {
            if (row.components && row.components.length > 0) {
                row.components.forEach((component, compIndex) => {
                    const emojiInfo = component.emoji ? `Emoji: ${component.emoji.name || component.emoji.id || 'unknown'}` : 'Emoji: none';
                    Loggers.Bot.debug(`  [${rowIndex}][${compIndex}] Type: ${component.type}, Label: ${component.label}, CustomId: ${component.customId}, ${emojiInfo}`);
                });
            }
        });
    } else {
        Loggers.Bot.debug(`Message has no components`);
    }

    setTimeout(async () => {
        try {
            Loggers.Bot.debug(`Checking for giveaway actions in ${message.channel.id}`);

            // Find button with 🎉 emoji (check by emoji character, emoji ID, or label)
            if (message.components && message.components.length > 0) {
                const tadaButton = message.components.flatMap(row => row.components).find(b => {
                    if (!b) return false;

                    // Check emoji name (unicode emoji)
                    if (b.emoji && b.emoji.name && b.emoji.name.includes('🎉')) return true;

                    // Check emoji ID (custom emoji)
                    if (b.emoji && b.emoji.id) {
                        // Custom emoji - check if it might be a tada emoji
                        // We'll try to click it if it's a giveaway button
                        return true;
                    }

                    // Check label for 🎉 emoji
                    if (b.label && b.label.includes('🎉')) return true;

                    // Check if it's a giveaway-related button (common patterns)
                    if (b.label && (
                        b.label.toLowerCase().includes('giveaway') ||
                        b.label.toLowerCase().includes('join') ||
                        b.label.toLowerCase().includes('katıl')
                    )) return true;

                    return false;
                });

                if (tadaButton) {
                    Loggers.Bot.info(`Clicking button: ${tadaButton.label || tadaButton.customId} with 🎉 emoji on ${message.channel.id}`);

                    try {
                        // Try clicking with the button object directly
                        await message.clickButton(tadaButton);
                        Loggers.Bot.info(`Button clicked successfully on ${message.channel.id}`);
                    } catch (error) {
                        Loggers.Bot.debug(`Error clicking button: ${error.message}`);
                        // Fallback: try with customId if available
                        if (tadaButton.customId) {
                            try {
                                await message.clickButton(tadaButton.customId);
                                Loggers.Bot.info(`Button clicked with customId on ${message.channel.id}`);
                            } catch (e) {
                                Loggers.Bot.error(`Error with customId: ${e.message}`);
                            }
                        } else {
                            Loggers.Bot.error(`Button has no customId and cannot be clicked`);
                        }
                    }
                } else {
                    Loggers.Bot.debug(`No 🎉 button found in ${message.channel.id}`);
                }
            }

            // Check for 🎊 reaction (reaction-based giveaway)
            // This runs even if buttons exist, as some giveaways use both
            const tadaReaction = message.reactions.cache.get('🎊');
            if (tadaReaction) {
                try {
                    // Check if we already reacted
                    const hasReacted = tadaReaction.users.cache.has(message.client.user.id);
                    if (hasReacted) {
                        Loggers.Bot.debug(`Already reacted with 🎊 on ${message.channel.id}`);
                    } else {
                        // React with 🎊 to join the giveaway
                        await message.react('🎊');
                        Loggers.Bot.info(`Reacted with 🎊 on ${message.channel.id}`);
                    }
                } catch (error) {
                    Loggers.Bot.debug(`Error reacting with 🎊: ${error.message}`);
                }
            } else {
                Loggers.Bot.debug(`No 🎊 reaction found in ${message.channel.id}`);
            }
        } catch (error) {
            Loggers.Bot.error(`Giveaway handler error: ${error.message}`);
        }
    }, DELAY_MS);
}

module.exports = { handleGiveawayMessage };
