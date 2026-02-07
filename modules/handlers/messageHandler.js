const configManager = require('../config/configManager');
const { botState, CAPTCHA_KEYWORDS } = require('../core/state');
const { stopBot, resumeBot } = require('../core/state');
const { setTrackedTimeout, clearAllTrackedTimeouts, clearAllCaches } = require('../services/discordService');
const { delay } = require('../utils/helpers');
const { handleUncaughtException } = require('../utils/errorHandler');
const { Loggers } = require('../utils/logger');

/**
 * Clear CAPTCHA state
 * @param {string} reason - Reason for clearing CAPTCHA state
 * @returns {Promise<void>}
 */
async function clearCaptchaState(reason) {
    Loggers.Captcha.info(`Clearing CAPTCHA state (Reason: ${reason})`);
    botState.captchaDetected = false;
    clearAllCaches();
}

/**
 * Handle CAPTCHA notification
 * @param {Client} client - Discord client instance
 * @param {Message} message - Discord message object
 * @returns {Promise<void>}
 */
async function handleCaptchaNotification(client, message) {
    Loggers.Captcha.debug('CAPTCHA algılandı! Debug başlıyor...');
    Loggers.Captcha.debug(`Message content: ${message.content}`);
    Loggers.Captcha.debug(`Checking for CAPTCHA keywords: ${JSON.stringify(CAPTCHA_KEYWORDS)}`);
    stopBot(false);

    botState.captchaDetected = true;
    // Note: Status updates are disabled to avoid detection

    if (process.send) {
        Loggers.Captcha.debug('Main.js\'e CAPTCHA mesajı gönderiliyor...');
        process.send({
            type: 'captcha',
            userId: client.user.id,
            username: client.user.username,
            messageId: message.id,
            channelId: message.channel.id,
            guildId: message.guild?.id || null
        });
        Loggers.Captcha.debug('Main.js\'e CAPTCHA mesajı gönderildi');
    } else {
        Loggers.Captcha.error('process.send mevcut değil!');
    }
}

/**
 * Handle incoming messages
 * @param {Client} client - Discord client instance
 * @param {Message} message - Discord message object
 * @returns {Promise<void>}
 */
async function handleIncomingMessage(client, message) {
    const config = configManager.getConfig();

    if (message.channel.type === 'DM' && message.content.trim() === '!alert') {
        if (process.send) {
            process.send({
                type: 'channel_monitor_alert',
                userId: client.user.id,
                channelId: 'örnek_kanal_id',
                author: 'Örnek Kullanıcı',
                content: 'Bu bir örnek mesaj içeriği.'
            });
        }
        return;
    }

    if (botState.monitoring && botState.isOwoEnabled && message.guild && message.channel.type !== 'DM') {
        const TEN_MINUTES_MS = 10 * 60 * 1000;
        const channelTimer = botState.timedChannels[message.channel.id];
        const isTimeExpired = channelTimer && channelTimer.elapsed >= TEN_MINUTES_MS;

        let isFarmChannel = false;

        if (isTimeExpired) {
            isFarmChannel = botState.channelIds.includes(message.channel.id);
        } else {
            isFarmChannel = botState.channelIds.includes(message.channel.id) ||
                           message.channel.id === (botState.activeTimedFarm?.channelId || null);
        }

        if (isFarmChannel && !message.author.bot && message.author.id !== client.user.id) {
            if (botState.isOwoEnabled) {
                botState.isOwoEnabled = false;
            }

            if (process.send) {
                process.send({
                    type: 'channel_monitor_alert',
                    userId: client.user.id,
                    channelId: message.channel.id,
                    author: message.author.username,
                    content: message.content.substring(0, 100) + (message.content.length > 100 ? '...' : '')
                });
            }
        }
    }

    if (message.author.id !== config.owo_ID || botState.captchaDetected) return;
    if (message.channel.type === 'DM' || !message.content.includes(`<@${client.user.id}>`)) return;

    const content = message.content.toLowerCase().replace(/\u200B/g, '');
    Loggers.Captcha.debug(`Checking message for CAPTCHA keywords: ${content}`);
    const foundKeyword = CAPTCHA_KEYWORDS.find(keyword => content.includes(keyword));
    if (foundKeyword) {
        Loggers.Captcha.debug(`CAPTCHA keyword detected in message: "${foundKeyword}"`);
        await handleCaptchaNotification(client, message);
    } else {
        Loggers.Captcha.debug('No CAPTCHA keywords found in message');
    }
}

/**
 * Handle CAPTCHA DM messages
 * @param {Client} client - Discord client instance
 * @param {Message} message - Discord message object
 * @returns {Promise<void>}
 */
async function handleCaptchaDM(client, message) {
    const config = configManager.getConfig();

    if (!botState.isCaptchaDmHandlerEnabled || message.channel.type !== 'DM' || message.author.id !== config.owo_ID) return;

    const isVerified = message.content.includes('verified that you are human') || message.content.includes('Thank you for verifying');
    if (isVerified) {
        Loggers.Captcha.info('CAPTCHA çözümü doğrulandı...');

        // Send captcha_solved message to main process (which forwards to bot.js)
        if (process.send) {
            Loggers.Captcha.debug('Sending captcha_solved message to main.js...');
            process.send({
                type: 'captcha_solved',
                userId: client.user.id
            });
            Loggers.Captcha.debug('captcha_solved message sent');
        }

        await clearCaptchaState("Doğrulama alındı");
        await delay(15000);
        if (!botState.isRunning) {
            if(resumeBot()) {
                // Note: Status updates are disabled to avoid detection
            }
        }
    }
}

module.exports = {
    handleIncomingMessage,
    handleCaptchaDM,
    clearCaptchaState,
    handleCaptchaNotification,
};
