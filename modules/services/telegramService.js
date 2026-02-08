const axios = require('axios');

/**
 * Telegram Bot Service
 * Handles sending messages to Telegram bot
 */
class TelegramService {
    constructor() {
        this.token = null;
        this.chatId = null;
        this.baseUrl = null;
    }

    /**
     * Initialize Telegram service
     * @param {string} token - Telegram bot token
     * @param {string} chatId - Telegram chat ID
     */
    init(token, chatId) {
        this.token = token;
        this.chatId = chatId;
        this.baseUrl = `https://api.telegram.org/bot${token}`;
    }

    /**
     * Check if Telegram service is configured
     * @returns {boolean}
     */
    isConfigured() {
        return !!(this.token && this.chatId);
    }

    /**
     * Send message to Telegram
     * @param {string} text - Message text
     * @param {Object} options - Additional options (parse_mode, etc.)
     * @returns {Promise<boolean>} Success status
     */
    async sendMessage(text, options = {}) {
        if (!this.isConfigured()) {
            return false;
        }

        try {
            const response = await axios.post(`${this.baseUrl}/sendMessage`, {
                chat_id: this.chatId,
                text: text,
                parse_mode: 'HTML',
                disable_web_page_preview: true,
                ...options
            });
            return response.data.ok;
        } catch (error) {
            console.error('Telegram send error:', error.response?.data || error.message);
            return false;
        }
    }

    /**
     * Send CAPTCHA notification to Telegram
     * @param {Object} data - CAPTCHA data
     * @returns {Promise<boolean>} Success status
     */
    async sendCaptchaAlert(data) {
        const { username, userId, messageId, channelId, guildId } = data;

        const message = `<b>🚨 ${username} - CAPTCHA TESPİT EDİLDİ</b>\n\n` +
            `<b>User ID:</b> ${userId}\n` +
            `<b>Mesaj ID:</b> ${messageId || '-'}\n` +
            `<b>Kanal ID:</b> ${channelId || '-'}\n` +
            `<b>Sunucu ID:</b> ${guildId || '-'}\n\n` +
            `<i>Lütfen CAPTCHA'yı manuel olarak çözün.</i>`;

        return await this.sendMessage(message);
    }

    /**
     * Send CAPTCHA solved notification to Telegram
     * @param {Object} data - CAPTCHA data
     * @returns {Promise<boolean>} Success status
     */
    async sendCaptchaSolved(data) {
        const { username, userId } = data;

        const message = `<b>✅ ${username} - CAPTCHA ÇÖZÜLDÜ</b>\n\n` +
            `<b>User ID:</b> ${userId}\n\n` +
            `<i>Bot işlemlerine devam ediliyor.</i>`;

        return await this.sendMessage(message);
    }

    /**
     * Send channel monitor alert to Telegram
     * @param {Object} data - Alert data
     * @returns {Promise<boolean>} Success status
     */
    async sendChannelAlert(data) {
        const { username, userId, channelId, author, content } = data;

        const message = `<b>⚠️ ${username} - FARM KANALI UYARISI</b>\n\n` +
            `<b>Bot User ID:</b> ${userId}\n` +
            `<b>Kanal ID:</b> ${channelId}\n` +
            `<b>Mesaj Gönderen:</b> ${author || '-'}\n` +
            `<b>Mesaj:</b> ${content || '-'}\n\n` +
            `<i>Farm kanalında birisi mesaj gönderdi.</i>`;

        return await this.sendMessage(message);
    }
}

module.exports = new TelegramService();