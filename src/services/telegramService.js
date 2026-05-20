/**
 * Telegram Notification Service
 *
 * @module services/telegramService
 */

const axios = require('axios');
const configManager = require('../config/manager');
const { Loggers } = require('../utils/logger');

const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';
const CAPTCHA_URL = 'https://owobot.com/captcha';
const MAX_ALERT_CONTENT_LENGTH = 100;
const DEFAULT_TIMEOUT = 10000;

let telegramConfig = null;

function getTelegramConfig() {
    if (!telegramConfig) {
        const config = configManager.getConfig();
        if (config && config.telegramBotToken && config.telegramChatId) {
            telegramConfig = {
                botToken: config.telegramBotToken,
                chatId: config.telegramChatId,
                apiUrl: `${TELEGRAM_API_BASE}${config.telegramBotToken}`
            };
        }
    }
    return telegramConfig;
}

async function sendTelegramMessage(message, options = {}) {
    const config = getTelegramConfig();
    if (!config) {
        Loggers.Webhook.debug('Telegram not configured, skipping notification');
        return false;
    }

    try {
        const response = await axios.post(
            `${config.apiUrl}/sendMessage`,
            {
                chat_id: config.chatId,
                text: message,
                parse_mode: options.parseMode || 'HTML'
            },
            { timeout: options.timeout || DEFAULT_TIMEOUT }
        );
        return response.data && response.data.ok;
    } catch (error) {
        Loggers.Webhook.warn('Failed to send Telegram message', error.message);
        return false;
    }
}

async function sendCaptchaNotification(captchaData) {
    const { userId, username } = captchaData;
    const message = `
🚨 <b>Captcha Tespit Edildi</b>
👤 <b>Kullanıcı:</b> ${username || 'Bilinmiyor'}
🆔 <b>Kullanıcı ID:</b> <code>${userId}</code>
🔗 <b>Doğrulama:</b> ${CAPTCHA_URL}
— <b>Durum:</b> Farm durduruldu
    `.trim();

    const sent = await sendTelegramMessage(message, { parseMode: 'HTML' });
    if (sent) {
        return { success: true, userId, timestamp: Date.now() };
    }
    return null;
}

async function sendCaptchaSolvedNotification(userId) {
    const message = `
✅ <b>Captcha Çözüldü</b>
🆔 <b>Kullanıcı ID:</b> <code>${userId}</code>
— <b>Durum:</b> Farm yeniden başlatılıyor
    `.trim();

    return await sendTelegramMessage(message, { parseMode: 'HTML' });
}

async function sendChannelAlert(alertData) {
    const { channelId, author, content } = alertData;
    const truncatedContent = content ? content.substring(0, MAX_ALERT_CONTENT_LENGTH) : 'N/A';

    const message = `
⚠️ <b>Farm Kanal Uyarısı</b>
👤 <b>Kullanıcı:</b> ${author || 'Bilinmiyor'}
📢 <b>Kanal:</b> <code>${channelId}</code>
💬 <b>Mesaj:</b> ${truncatedContent}
— <b>Durum:</b> Farm durduruldu
    `.trim();

    return await sendTelegramMessage(message, { parseMode: 'HTML' });
}

module.exports = {
    sendCaptchaNotification,
    sendCaptchaSolvedNotification,
    sendChannelAlert
};
