const dotenv = require('dotenv');

/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
    tokens: [],
    discordBotToken: null,
    CH_IDS: [],
    owo_ID: '408785106942164992',
    telegramBotToken: null,
    telegramChatId: null,
    DEFAULT_PRESENCE: 'invisible',
    enableConsoleLog: false
};

/**
 * Configuration Manager
 * Handles loading, validation, and management of application configuration from .env
 */
class ConfigManager {
    constructor() {
        this.config = null;
    }

    /**
     * Load configuration from environment variables
     * @returns {Promise<Object>} Configuration object
     */
    async loadConfig() {
        // Load environment variables from .env file
        dotenv.config();

        console.log('✅ ConfigManager: Loading configuration from .env...');
        this.config = this._loadFromEnv();

        // Validate configuration
        const validation = this.validateConfig(this.config);
        if (!validation.valid) {
            throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
        }

        console.log('✅ ConfigManager: Configuration loaded successfully');
        return this.config;
    }

    /**
     * Load configuration from environment variables
     * @returns {Object} Configuration object
     * @private
     */
    _loadFromEnv() {
        // Parse tokens from comma-separated TOKENS variable or fallback to USER_TOKEN_* pattern
        let tokens = [];
        
        if (process.env.TOKENS) {
            // New format: comma-separated tokens in TOKENS variable
            tokens = process.env.TOKENS.split(',').map(token => token.trim()).filter(token => token);
        } else {
            // Legacy format: USER_TOKEN_1, USER_TOKEN_2, etc.
            let i = 1;
            while (process.env[`USER_TOKEN_${i}`]) {
                tokens.push(process.env[`USER_TOKEN_${i}`]);
                i++;
            }
        }

        // Parse channel IDs
        const channelIds = process.env.CHANNEL_IDS 
            ? process.env.CHANNEL_IDS.split(',').map(id => id.trim()).filter(id => id)
            : [];

        return {
            tokens: tokens,
            discordBotToken: process.env.DISCORD_BOT_TOKEN || null,
            CH_IDS: channelIds,
            owo_ID: process.env.OWO_ID || DEFAULT_CONFIG.owo_ID,
            telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || null,
            telegramChatId: process.env.TELEGRAM_CHAT_ID || null,
            DEFAULT_PRESENCE: process.env.DEFAULT_PRESENCE || DEFAULT_CONFIG.DEFAULT_PRESENCE,
            enableConsoleLog: process.env.ENABLE_CONSOLE_LOG === 'true'
        };
    }

    /**
     * Validate configuration
     * @param {Object} config - Configuration object to validate
     * @returns {Object} Validation result with valid flag and errors array
     */
    validateConfig(config) {
        const errors = [];

        // Validate tokens
        if (!Array.isArray(config.tokens)) {
            errors.push('tokens must be an array');
        } else if (config.tokens.length === 0) {
            errors.push('At least one user token is required in TOKENS environment variable');
        } else {
            config.tokens.forEach((token, index) => {
                if (typeof token !== 'string' || !token.trim()) {
                    errors.push(`Token at index ${index} is invalid`);
                }
                // Check for placeholder tokens
                if (token.includes('YOUR_') || token === 'your_token_here') {
                    errors.push(`Token at index ${index} is a placeholder. Please replace with actual token`);
                }
            });
        }

        // Validate bot token (optional)
        if (config.discordBotToken) {
            if (typeof config.discordBotToken !== 'string' || !config.discordBotToken.trim()) {
                errors.push('DISCORD_BOT_TOKEN must be a non-empty string');
            }
            if (config.discordBotToken.includes('YOUR_') || config.discordBotToken === 'your_bot_token_here') {
                errors.push('DISCORD_BOT_TOKEN is a placeholder. Please replace with actual token or remove it');
            }
        }

        // Validate channel IDs (optional - can farm without pre-configured channels)
        if (!Array.isArray(config.CH_IDS)) {
            errors.push('CHANNEL_IDS must be a comma-separated list');
        } else if (config.CH_IDS.length > 0) {
            config.CH_IDS.forEach((channelId, index) => {
                if (typeof channelId !== 'string' || !channelId.trim()) {
                    errors.push(`Channel ID at index ${index} is invalid`);
                }
                // Basic Discord ID validation (should be numeric)
                if (!/^\d+$/.test(channelId)) {
                    errors.push(`Channel ID at index ${index} must be numeric`);
                }
            });
        }

        // Validate OWO ID
        if (!config.owo_ID || typeof config.owo_ID !== 'string') {
            errors.push('OWO_ID must be a non-empty string');
        }
        if (config.owo_ID && !/^\d+$/.test(config.owo_ID)) {
            errors.push('OWO_ID must be numeric');
        }

        // Validate Telegram configuration (optional, but both must be present if using Telegram)
        if (config.telegramBotToken || config.telegramChatId) {
            if (!config.telegramBotToken) {
                errors.push('TELEGRAM_BOT_TOKEN is required when TELEGRAM_CHAT_ID is set');
            }
            if (!config.telegramChatId) {
                errors.push('TELEGRAM_CHAT_ID is required when TELEGRAM_BOT_TOKEN is set');
            }
            if (config.telegramBotToken && config.telegramBotToken.includes('YOUR_')) {
                errors.push('TELEGRAM_BOT_TOKEN is a placeholder. Please replace with actual token');
            }
            if (config.telegramChatId && config.telegramChatId.includes('YOUR_')) {
                errors.push('TELEGRAM_CHAT_ID is a placeholder. Please replace with actual chat ID');
            }
        }

        // Validate presence
        const validPresences = ['invisible', 'online', 'idle', 'dnd'];
        if (config.DEFAULT_PRESENCE && !validPresences.includes(config.DEFAULT_PRESENCE)) {
            errors.push(`DEFAULT_PRESENCE must be one of: ${validPresences.join(', ')}`);
        }

        // Validate console log flag
        if (config.enableConsoleLog !== undefined && typeof config.enableConsoleLog !== 'boolean') {
            errors.push('ENABLE_CONSOLE_LOG must be true or false');
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Get configuration with sensitive data sanitized for logging
     * @returns {Object} Sanitized configuration object
     */
    getSecureConfig() {
        if (!this.config) {
            return null;
        }

        return {
            ...this.config,
            tokens: this.config.tokens.map(() => '[REDACTED]'),
            discordBotToken: this.config.discordBotToken ? '[REDACTED]' : null,
            telegramBotToken: this.config.telegramBotToken ? '[REDACTED]' : null,
            telegramChatId: this.config.telegramChatId ? '[REDACTED]' : null
        };
    }

    /**
     * Get current configuration
     * @returns {Object} Configuration object
     */
    getConfig() {
        return this.config;
    }
}

module.exports = new ConfigManager();
