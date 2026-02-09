const configManager = require('../config/manager');
const { botState, CAPTCHA_KEYWORDS } = require('../core/state');
const { stopBot, resumeBot } = require('../core/state');
const { setTrackedTimeout, clearAllCaches } = require('../services/discordService');
const { delay } = require('../utils/helpers');
const { sendCaptchaNotification, sendCaptchaSolvedNotification, sendChannelAlert } = require('../services/telegramService');
const { Loggers } = require('../utils/logger');
const { TIMEOUTS, FARMING_LIMITS } = require('../constants/timeouts');
const IPCMessageBuilder = require('../utils/ipcMessageBuilder');
const CaptchaTracker = require('../classes/CaptchaTracker');

// Constants
const CAPTCHA_SOLVED_PHRASES = [
    'verified that you are human',
    'thank you for verifying'
];

// Get OWO ID from config manager
const getOwoId = () => configManager.getOwoId();

// Captcha notification tracker instance
const captchaTracker = new CaptchaTracker();

/**
 * Clear CAPTCHA state and caches
 * @param {string} reason - Reason for clearing state
 */
async function clearCaptchaState(reason) {
    Loggers.Captcha.info(`Clearing CAPTCHA state (Reason: ${reason})`);
    botState.captchaDetected = false;

    if (captchaTracker.size > 0) {
        Loggers.Captcha.debug(`Clearing ${captchaTracker.size} stored CAPTCHA notification entries...`);
        captchaTracker.clearAll();
    }

    clearAllCaches();
}

/**
 * Process CAPTCHA detection logic
 * @param {Client} client 
 * @param {Message} message 
 */
async function processCaptchaDetection(client, message) {
    Loggers.Captcha.debug('CAPTCHA algılandı! Debug başlıyor...');
    Loggers.Captcha.debug(`Message content: ${message.content}`);

    stopBot(false);
    botState.captchaDetected = true;

    // Notify Main Process
    if (process.send) {
        process.send(IPCMessageBuilder.buildCaptchaNotification({
            userId: client.user.id,
            username: client.user.username,
            messageId: message.id,
            channelId: message.channel.id,
            guildId: message.guild?.id || null,
            guildName: message.guild?.name || 'Unknown',
            channelName: message.channel.name || 'Unknown'
        }));
    } else {
        Loggers.Captcha.error('process.send mevcut değil!');
    }

    // Notify Telegram
    const result = await sendCaptchaNotification({
        userId: client.user.id,
        username: client.user.username
    });

    if (result?.success) {
        captchaTracker.markSent(client.user.id, true);
        Loggers.Captcha.info('CAPTCHA notification sent via Telegram');
    } else {
        Loggers.Captcha.warn('Failed to send CAPTCHA notification via Telegram');
    }
}

/**
 * Handle admin/debug commands in DM
 */
async function handleAdminCommands(client, message) {
    if (message.channel.type !== 'DM' || message.content.trim() !== '!alert') return false;

    if (process.send) {
        process.send(IPCMessageBuilder.buildMonitorAlert({
            userId: client.user.id,
            channelId: 'debug_channel',
            author: 'Debug User',
            content: 'Debug alert message'
        }));
    }
    return true;
}

/**
 * Handle channel monitoring logic (farming detection)
 */
async function handleMonitoring(client, message) {
    if (!botState.monitoring || !botState.isOwoEnabled || !message.guild || message.channel.type === 'DM') {
        return;
    }

    const channelTimer = botState.timedChannels[message.channel.id];
    const isTimeExpired = channelTimer && channelTimer.elapsed >= FARMING_LIMITS.CHANNEL_FARM_LIMIT;
    
    const isFarmChannel = isTimeExpired 
        ? botState.channelIds.includes(message.channel.id)
        : (botState.channelIds.includes(message.channel.id) || message.channel.id === botState.activeTimedFarm?.channelId);
    
    // Check if message is from another user (not me, not bot)
    if (isFarmChannel && !message.author.bot && message.author.id !== client.user.id) {
        if (botState.isOwoEnabled) {
            botState.isOwoEnabled = false;
        }
        
        // Notify Telegram
        await sendChannelAlert({
            channelId: message.channel.id,
            author: message.author.username,
            content: message.content
        });

        // Notify Main Process
        if (process.send) {
            process.send(IPCMessageBuilder.buildMonitorAlert({
                userId: client.user.id,
                channelId: message.channel.id,
                author: message.author.username,
                content: message.content
            }));
        }
    }
}

/**
 * Handle incoming OWO bot messages for CAPTCHA
 */
async function handleOwoMessage(client, message) {
    if (message.author.id !== getOwoId() || botState.captchaDetected) return;
    
    // Check for mention
    if (message.channel.type === 'DM' || !message.content.includes(`<@${client.user.id}>`)) return;

    const content = message.content.toLowerCase().replace(/\u200B/g, '');
    const foundKeyword = CAPTCHA_KEYWORDS.find(keyword => content.includes(keyword));

    if (foundKeyword) {
        Loggers.Captcha.debug(`CAPTCHA keyword detected: "${foundKeyword}"`);
        await processCaptchaDetection(client, message);
    }
}

/**
 * Main message handler entry point
 */
async function handleIncomingMessage(client, message) {
    if (await handleAdminCommands(client, message)) return;
    await handleMonitoring(client, message);
    await handleOwoMessage(client, message);
}

/**
 * Handle DM messages for CAPTCHA resolution confirmation
 */
async function handleCaptchaDM(client, message) {
    if (!botState.isCaptchaDmHandlerEnabled || 
        message.channel.type !== 'DM' || 
        message.author.id !== getOwoId()) return;

    const isVerified = CAPTCHA_SOLVED_PHRASES.some(phrase => 
        message.content.toLowerCase().includes(phrase.toLowerCase())
    );

    if (isVerified) {
        Loggers.Captcha.info('CAPTCHA solution verified by OWO bot');

        await sendCaptchaSolvedNotification(client.user.id);

        if (process.send) {
            process.send(IPCMessageBuilder.buildCaptchaSolved(client.user.id));
        }

        await clearCaptchaState("Verification Received");
        await delay(TIMEOUTS.CAPTCHA_VERIFY_DELAY);
        
        if (!botState.isRunning) {
            resumeBot();
        }
    }
}

module.exports = {
    handleIncomingMessage,
    handleCaptchaDM,
    clearCaptchaState,
    handleCaptchaNotification: processCaptchaDetection // Export alias for compatibility
};
