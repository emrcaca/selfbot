const configManager = require('../config/manager');
const { botState, CAPTCHA_KEYWORDS } = require('../core/state');
const { stopBot, resumeBot } = require('../core/state');
const { setTrackedTimeout, clearAllCaches } = require('../services/discordService');
const { delay } = require('../utils/helpers');
const { sendCaptchaNotification, sendCaptchaSolvedNotification, sendChannelAlert } = require('../services/telegramService');
const { Loggers } = require('../utils/logger');

// Get OWO ID from config
function getOwoId() {
    const config = configManager.getConfig();
    return config ? config.owo_ID : '408785106942164992';
}

// Track sent CAPTCHA notifications
const sentCaptchaNotifications = new Map();

/**
 * Clear CAPTCHA state
 * @param {string} reason - Reason for clearing CAPTCHA state
 * @returns {Promise<void>}
 */
async function clearCaptchaState(reason) {
    Loggers.Captcha.info(`Clearing CAPTCHA state (Reason: ${reason})`);
    botState.captchaDetected = false;
    
    // Clear stored CAPTCHA notification data
    if (sentCaptchaNotifications.size > 0) {
        Loggers.Captcha.debug(`Clearing ${sentCaptchaNotifications.size} stored CAPTCHA notification entries...`);
        sentCaptchaNotifications.clear();
        Loggers.Captcha.debug('Stored CAPTCHA notification entries cleared');
    }

    // Clear caches to free memory
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
    
    // Send notification via Telegram
    const result = await sendCaptchaNotification({
        userId: client.user.id,
        username: client.user.username
    });
    
    if (result && result.success) {
        sentCaptchaNotifications.set(client.user.id, {
            sent: true,
            timestamp: Date.now()
        });
        Loggers.Captcha.info('CAPTCHA notification sent via Telegram');
    } else {
        Loggers.Captcha.warn('Failed to send CAPTCHA notification via Telegram');
    }
}

/**
 * Handle incoming messages
 * @param {Client} client - Discord client instance
 * @param {Message} message - Discord message object
 * @returns {Promise<void>}
 */
async function handleIncomingMessage(client, message) {
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
            
            // Send alert via Telegram
            await sendChannelAlert({
                channelId: message.channel.id,
                author: message.author.username,
                content: message.content
            });
            
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

    if (message.author.id !== getOwoId() || botState.captchaDetected) return;
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
    if (!botState.isCaptchaDmHandlerEnabled || message.channel.type !== 'DM' || message.author.id !== getOwoId()) return;

    const isVerified = message.content.includes('verified that you are human') || message.content.includes('Thank you for verifying');
    if (isVerified) {
        Loggers.Captcha.info('CAPTCHA çözümü doğrulandı...');

        // Send CAPTCHA solved notification via Telegram
        await sendCaptchaSolvedNotification(client.user.id);
        Loggers.Captcha.info('CAPTCHA solved notification sent via Telegram');

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