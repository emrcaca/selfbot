const axios = require('axios');
const configManager = require('../config/manager');
const { conditionalLog } = require('../utils/helpers');

/**
 * Telegram Notification Service
 * Handles sending notifications via Telegram Bot API
 */

let telegramConfig = null;

/**
 * Initialize Telegram configuration
 * @returns {Object|null} Telegram config or null if not configured
 */
function getTelegramConfig() {
    if (!telegramConfig) {
        const config = configManager.getConfig();
        if (config && config.telegramBotToken && config.telegramChatId) {
            telegramConfig = {
                botToken: config.telegramBotToken,
                chatId: config.telegramChatId,
                apiUrl: `https://api.telegram.org/bot${config.telegramBotToken}`
            };
        }
    }
    return telegramConfig;
}

/**
 * Check if Telegram is configured
 * @returns {boolean} Whether Telegram is configured
 */
function isTelegramEnabled() {
    const config = getTelegramConfig();
    return config !== null;
}

/**
 * Send a text message via Telegram
 * @param {string} message - Message to send
 * @param {Object} options - Additional options
 * @returns {Promise<boolean>} Whether the message was sent successfully
 */
async function sendTelegramMessage(message, options = {}) {
    const config = getTelegramConfig();
    
    if (!config) {
        conditionalLog('⚠️ Telegram not configured, skipping notification');
        return false;
    }

    try {
        const payload = {
            chat_id: config.chatId,
            text: message,
            parse_mode: options.parseMode || 'HTML',
            disable_web_page_preview: options.disablePreview !== false
        };

        const response = await axios.post(
            `${config.apiUrl}/sendMessage`,
            payload,
            { timeout: 10000 }
        );

        if (response.data && response.data.ok) {
            conditionalLog('✅ Telegram message sent successfully');
            return true;
        } else {
            conditionalLog('❌ Telegram API returned error:', response.data);
            return false;
        }
    } catch (error) {
        console.error('❌ Failed to send Telegram message:', error.message);
        return false;
    }
}

/**
 * Send CAPTCHA notification via Telegram
 * @param {Object} captchaData - CAPTCHA event data
 * @returns {Promise<Object|null>} Message info or null
 */
async function sendCaptchaNotification(captchaData) {
    const { userId, username } = captchaData;
    
    const message = `
🚨 <b>CAPTCHA Algılandı!</b>

👤 <b>Kullanıcı:</b> ${username || 'Unknown'}
🆔 <b>User ID:</b> <code>${userId}</code>

⚠️ Bot durduruldu. CAPTCHA'yı çözmek için:
🔗 https://owobot.com/captcha

CAPTCHA çözüldükten sonra bot otomatik devam edecek.
`.trim();

    const sent = await sendTelegramMessage(message, { parseMode: 'HTML' });
    
    if (sent) {
        return {
            success: true,
            userId: userId,
            timestamp: Date.now()
        };
    }
    
    return null;
}

/**
 * Send CAPTCHA solved notification via Telegram
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} Whether notification was sent
 */
async function sendCaptchaSolvedNotification(userId) {
    const message = `
✅ <b>CAPTCHA Çözüldü!</b>

🆔 <b>User ID:</b> <code>${userId}</code>

Bot otomatik olarak devam ediyor...
`.trim();

    return await sendTelegramMessage(message, { parseMode: 'HTML' });
}

/**
 * Send channel monitor alert via Telegram
 * @param {Object} alertData - Alert data
 * @returns {Promise<boolean>} Whether alert was sent
 */
async function sendChannelAlert(alertData) {
    const { channelId, author, content } = alertData;
    
    const message = `
⚠️ <b>Farm Kanalı Uyarısı</b>

📢 <b>Kanal:</b> <code>${channelId}</code>
👤 <b>Kullanıcı:</b> ${author || 'Unknown'}
💬 <b>Mesaj:</b> ${content ? content.substring(0, 100) : 'N/A'}

Farm otomatik olarak durduruldu.
`.trim();

    return await sendTelegramMessage(message, { parseMode: 'HTML' });
}

module.exports = {
    isTelegramEnabled,
    sendTelegramMessage,
    sendCaptchaNotification,
    sendCaptchaSolvedNotification,
    sendChannelAlert
};
