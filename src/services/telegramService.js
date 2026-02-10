/**
 * Telegram Notification Service
 *
 * Handles sending notifications via Telegram Bot API including:
 * - CAPTCHA detection notifications
 * - CAPTCHA solved notifications
 * - Channel monitoring alerts
 * - General message sending
 *
 * @module services/telegramService
 */

const axios = require('axios');
const configManager = require('../config/manager');
const { conditionalLog } = require('../utils/helpers');

// ============================================================================
// CONSTANTS
// ============================================================================

/** Telegram Bot API base URL */
const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';

/** Default request timeout in milliseconds */
const DEFAULT_TIMEOUT = 10000;

/** Maximum message content length for alerts */
const MAX_ALERT_CONTENT_LENGTH = 100;

/** CAPTCHA solving URL */
const CAPTCHA_URL = 'https://owobot.com/captcha';

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Cached Telegram configuration */
let telegramConfig = null;

/**
 * Get Telegram configuration
 *
 * Loads and caches the Telegram configuration from the
 * config manager.
 *
 * @returns {Object|null} Telegram config or null if not configured
 */
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

/**
 * Check if Telegram is configured
 *
 * @returns {boolean} Whether Telegram is configured
 */
function isTelegramEnabled() {
    const config = getTelegramConfig();
    return config !== null;
}

/**
 * Reset cached Telegram configuration
 *
 * Forces a reload of the Telegram configuration on next access.
 * Useful for runtime configuration changes.
 */
function resetTelegramConfig() {
    telegramConfig = null;
}

// ============================================================================
// MESSAGE SENDING
// ============================================================================

/**
 * Send a text message via Telegram
 *
 * @param {string} message - Message to send
 * @param {Object} options - Additional options
 * @param {string} options.parseMode - Parse mode ('HTML' or 'Markdown')
 * @param {boolean} options.disablePreview - Disable web page preview
 * @param {boolean} options.disableNotification - Send silently
 * @param {string} options.replyToMessageId - Reply to specific message
 * @returns {Promise<boolean>} Whether the message was sent successfully
 */
async function sendTelegramMessage(message, options = {}) {
    const config = getTelegramConfig();

    if (!config) {
        conditionalLog('Telegram not configured, skipping notification');
        return false;
    }

    try {
        const payload = {
            chat_id: config.chatId,
            text: message,
            parse_mode: options.parseMode || 'HTML',
            disable_web_page_preview: options.disablePreview !== false,
            disable_notification: options.disableNotification || false
        };

        // Add reply to message if specified
        if (options.replyToMessageId) {
            payload.reply_to_message_id = options.replyToMessageId;
        }

        const response = await axios.post(
            `${config.apiUrl}/sendMessage`,
            payload,
            { timeout: options.timeout || DEFAULT_TIMEOUT }
        );

        if (response.data && response.data.ok) {
            conditionalLog('Telegram message sent successfully');
            return true;
        } else {
            conditionalLog('Telegram API returned error:', response.data);
            return false;
        }
    } catch (error) {
        conditionalLog('Failed to send Telegram message:', error.message);
        return false;
    }
}

/**
 * Send a photo via Telegram
 *
 * @param {string} photoUrl - URL of the photo to send
 * @param {string} caption - Photo caption
 * @param {Object} options - Additional options
 * @returns {Promise<boolean>} Whether the photo was sent successfully
 */
async function sendTelegramPhoto(photoUrl, caption = '', options = {}) {
    const config = getTelegramConfig();

    if (!config) {
        return false;
    }

    try {
        const payload = {
            chat_id: config.chatId,
            photo: photoUrl,
            caption: caption,
            parse_mode: options.parseMode || 'HTML'
        };

        const response = await axios.post(
            `${config.apiUrl}/sendPhoto`,
            payload,
            { timeout: options.timeout || DEFAULT_TIMEOUT }
        );

        return response.data && response.data.ok;
    } catch (error) {
        conditionalLog(`Failed to send Telegram photo: ${error.message}`);
        return false;
    }
}

/**
 * Send a document via Telegram
 *
 * @param {string} documentUrl - URL of the document to send
 * @param {string} caption - Document caption
 * @param {Object} options - Additional options
 * @returns {Promise<boolean>} Whether the document was sent successfully
 */
async function sendTelegramDocument(documentUrl, caption = '', options = {}) {
    const config = getTelegramConfig();

    if (!config) {
        return false;
    }

    try {
        const payload = {
            chat_id: config.chatId,
            document: documentUrl,
            caption: caption,
            parse_mode: options.parseMode || 'HTML'
        };

        const response = await axios.post(
            `${config.apiUrl}/sendDocument`,
            payload,
            { timeout: options.timeout || DEFAULT_TIMEOUT }
        );

        return response.data && response.data.ok;
    } catch (error) {
        conditionalLog(`Failed to send Telegram document: ${error.message}`);
        return false;
    }
}

// ============================================================================
// CAPTCHA NOTIFICATIONS
// ============================================================================

/**
 * Send CAPTCHA notification via Telegram
 *
 * Notifies the user when a CAPTCHA has been detected and
 * the bot has been stopped.
 *
 * @param {Object} captchaData - CAPTCHA event data
 * @param {string} captchaData.userId - User ID
 * @param {string} captchaData.username - Username
 * @returns {Promise<Object|null>} Message info or null
 */
async function sendCaptchaNotification(captchaData) {
    const { userId, username } = captchaData;

    const message = `
🚨 <b>CAPTCHA Detected!</b>

👤 <b>User:</b> ${username || 'Unknown'}
🆔 <b>User ID:</b> <code>${userId}</code>

⚠️ Bot stopped. To solve the CAPTCHA:
🔗 ${CAPTCHA_URL}

Bot will automatically resume after CAPTCHA is solved.
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
 *
 * Notifies the user when the CAPTCHA has been solved and
 * the bot has resumed.
 *
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} Whether notification was sent
 */
async function sendCaptchaSolvedNotification(userId) {
    const message = `
✅ <b>CAPTCHA Solved!</b>

🆔 <b>User ID:</b> <code>${userId}</code>

Bot is automatically resuming...
`.trim();

    return await sendTelegramMessage(message, { parseMode: 'HTML' });
}

// ============================================================================
// CHANNEL MONITORING ALERTS
// ============================================================================

/**
 * Send channel monitor alert via Telegram
 *
 * Notifies the user when activity is detected in a farming channel.
 *
 * @param {Object} alertData - Alert data
 * @param {string} alertData.channelId - Channel ID
 * @param {string} alertData.author - Author username
 * @param {string} alertData.content - Message content
 * @returns {Promise<boolean>} Whether alert was sent
 */
async function sendChannelAlert(alertData) {
    const { channelId, author, content } = alertData;

    const truncatedContent = content
        ? content.substring(0, MAX_ALERT_CONTENT_LENGTH)
        : 'N/A';

    const message = `
⚠️ <b>Farm Channel Alert</b>

📢 <b>Channel:</b> <code>${channelId}</code>
👤 <b>User:</b> ${author || 'Unknown'}
💬 <b>Message:</b> ${truncatedContent}

Farm has been automatically stopped.
`.trim();

    return await sendTelegramMessage(message, { parseMode: 'HTML' });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Truncate message content for alerts
 *
 * @param {string} content - Content to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated content
 */
function truncateAlertContent(content, maxLength = MAX_ALERT_CONTENT_LENGTH) {
    if (!content) {
        return 'N/A';
    }

    if (content.length <= maxLength) {
        return content;
    }

    return content.substring(0, maxLength - 3) + '...';
}

/**
 * Format timestamp for Telegram messages
 *
 * @param {Date|number} timestamp - Date or timestamp
 * @returns {string} Formatted timestamp
 */
function formatTimestamp(timestamp = Date.now()) {
    const date = new Date(timestamp);
    return date.toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * Get Telegram bot information
 *
 * @returns {Promise<Object|null>} Bot information or null
 */
async function getBotInfo() {
    const config = getTelegramConfig();

    if (!config) {
        return null;
    }

    try {
        const response = await axios.get(
            `${config.apiUrl}/getMe`,
            { timeout: DEFAULT_TIMEOUT }
        );

        if (response.data && response.data.ok) {
            return response.data.result;
        }

        return null;
    } catch (error) {
        conditionalLog('Failed to get Telegram bot info:', error.message);
        return null;
    }
}

/**
 * Test Telegram connection
 *
 * @returns {Promise<Object>} Test result
 */
async function testConnection() {
    const botInfo = await getBotInfo();

    if (!botInfo) {
        return {
            success: false,
            error: 'Failed to connect to Telegram API'
        };
    }

    const testMessage = await sendTelegramMessage(
        '✅ Telegram connection test successful!',
        { disablePreview: true }
    );

    return {
        success: testMessage,
        botInfo: {
            id: botInfo.id,
            username: botInfo.username,
            firstName: botInfo.first_name
        }
    };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    // Configuration
    isTelegramEnabled,
    resetTelegramConfig,

    // Message sending
    sendTelegramMessage,
    sendTelegramPhoto,
    sendTelegramDocument,

    // CAPTCHA notifications
    sendCaptchaNotification,
    sendCaptchaSolvedNotification,

    // Channel alerts
    sendChannelAlert,

    // Utility functions
    truncateAlertContent,
    formatTimestamp,
    getBotInfo,
    testConnection
};