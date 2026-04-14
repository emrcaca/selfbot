/**
 * Giveaway Handler Module
 *
 * Automatically joins giveaways by:
 * - Reacting to confetti_ball emoji buttons
 * - Clicking tada emoji buttons
 *
 * @module handlers/giveawayHandler
 */

const { Loggers } = require('../utils/logger');

const DELAY_MS = 5000;

async function handleGiveawayMessage(message, channelIds) {
    if (!channelIds || channelIds.length === 0) return;
    if (!channelIds.includes(message.channel.id)) return;
    if (!message.author.bot) return;
    if (message.author.id === message.client.user?.id) return;

    const channel = message.channel;
    if (!channel.isText()) return;

    const me = channel.guild?.members.me || await channel.guild?.members.fetch(message.client.user.id).catch(() => null);
    if (!me) return;
    if (!channel.permissionsFor(me).has('ViewChannel')) return;

    setTimeout(async () => {
        try {
            if (channel.permissionsFor(me).has('AddReactions')) {
                const hasConfetti = message.components.flatMap(row => row.components).some(b => b.emoji?.name === 'confetti_ball');
                if (hasConfetti) {
                    Loggers.Bot.info(`Giveaway reaction: 🎊 on ${message.channel.id}`);
                    await message.react('🎊');
                }
            }

            if (channel.permissionsFor(me).has('UseButtons')) {
                const hasTada = message.components.flatMap(row => row.components).some(b => b.emoji?.name === 'tada');
                if (hasTada) {
                    const tadaButton = message.components.flatMap(row => row.components).find(b => b.emoji?.name === 'tada');
                    const targetButton = tadaButton || message.components[0]?.components[0];

                    if (targetButton) {
                        Loggers.Bot.info(`Giveaway button: ${targetButton.label || targetButton.customId} on ${message.channel.id}`);
                        await message.clickButton(targetButton.customId);
                    }
                }
            }
        } catch (error) {
            Loggers.Bot.error(`Giveaway handler error: ${error.message}`);
        }
    }, DELAY_MS);
}

module.exports = { handleGiveawayMessage };
