const axios = require('axios');
const configManager = require('../config/manager');
const { conditionalLog } = require('../utils/helpers');

/**
 * Message Templates
 */
const TEMPLATES = {
    CAPTCHA_DETECTED: (user, id) => `
🚨 <b>CAPTCHA Algılandı!</b>

👤 <b>Kullanıcı:</b> ${user || 'Unknown'}
🆔 <b>User ID:</b> <code>${id}</code>

⚠️ Bot durduruldu. Lütfen manuel kontrol ediniz.
`.trim(),

    CAPTCHA_SOLVED: (id) => `
✅ <b>CAPTCHA Çözüldü!</b>

🆔 <b>User ID:</b> <code>${id}</code>

Bot otomatik olarak devam ediyor...
`.trim(),

    CHANNEL_ALERT: (channel, user, content) => `
⚠️ <b>Farm Kanalı Uyarısı</b>

📢 <b>Kanal:</b> <code>${channel}</code>
👤 <b>Kullanıcı:</b> ${user || 'Unknown'}
💬 <b>Mesaj:</b> ${content ? content.substring(0, 100) : 'N/A'}

Farm otomatik olarak durduruldu.
`.trim()
};

class TelegramService {
    constructor() {
        this.config = null;
    }

    /**
     * Get current configuration, refreshing from manager if needed
     * @private
     */
    _getConfig() {
        const globalConfig = configManager.getConfig();
        if (!globalConfig || !globalConfig.telegramBotToken || !globalConfig.telegramChatId) {
            return null;
        }

        return {
            botToken: globalConfig.telegramBotToken,
            chatId: globalConfig.telegramChatId,
            apiUrl: `https://api.telegram.org/bot${globalConfig.telegramBotToken}`
        };
    }

    /**
     * Check if Telegram notifications are enabled
     * @returns {boolean}
     */
    isEnabled() {
        return this._getConfig() !== null;
    }

    /**
     * Send a raw message to Telegram
     * @param {string} text - Message content
     * @param {Object} options - Additional options
     */
    async sendMessage(text, options = {}) {
        const config = this._getConfig();
        if (!config) {
            conditionalLog('⚠️ Telegram not configured, skipping notification');
            return false;
        }

        try {
            const response = await axios.post(`${config.apiUrl}/sendMessage`, {
                chat_id: config.chatId,
                text: text,
                parse_mode: options.parseMode || 'HTML',
                disable_web_page_preview: options.disablePreview !== false
            }, { timeout: 10000 });

            if (response.data && response.data.ok) {
                conditionalLog('✅ Telegram message sent successfully');
                return true;
            }
            
            conditionalLog(`❌ Telegram API error: ${response.data.description}`);
            return false;
        } catch (error) {
            console.error(`❌ Failed to send Telegram message: ${error.message}`);
            return false;
        }
    }

    /**
     * Send CAPTCHA detection alert
     */
    async sendCaptchaNotification({ userId, username }) {
        const message = TEMPLATES.CAPTCHA_DETECTED(username, userId);
        const sent = await this.sendMessage(message);
        
        return sent ? { success: true, userId, timestamp: Date.now() } : null;
    }

    /**
     * Send CAPTCHA solved notification
     */
    async sendCaptchaSolvedNotification(userId) {
        const message = TEMPLATES.CAPTCHA_SOLVED(userId);
        return await this.sendMessage(message);
    }

    /**
     * Send channel monitoring alert
     */
    async sendChannelAlert({ channelId, author, content }) {
        const message = TEMPLATES.CHANNEL_ALERT(channelId, author, content);
        return await this.sendMessage(message);
    }
}

// Export singleton instance but expose class for testing if needed
const service = new TelegramService();
// Backward compatibility aliases
service.isTelegramEnabled = service.isEnabled.bind(service);
service.sendTelegramMessage = service.sendMessage.bind(service);

module.exports = service;
