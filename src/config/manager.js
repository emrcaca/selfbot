const dotenv = require('dotenv');

/**
 * Default configuration values
 * @type {Readonly<Object>}
 */
const DEFAULTS = Object.freeze({
    OWO_ID: '408785106942164992',
    PRESENCE: 'invisible',
    CONSOLE_LOG: false
});

/**
 * Allowed presence statuses
 * @type {Readonly<string[]>}
 */
const VALID_PRESENCES = Object.freeze(['invisible', 'online', 'idle', 'dnd']);

/**
 * Configuration Manager
 * Handles loading, validation, and management of application configuration from .env
 */
class ConfigManager {
    constructor() {
        /** @type {Object|null} */
        this.config = null;
    }

    /**
     * Load configuration from environment variables
     * @returns {Promise<Object>} Configuration object
     * @throws {Error} If validation fails
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
     * Parse tokens from environment variables
     * Supports both comma-separated TOKENS and legacy USER_TOKEN_X formats
     * @returns {string[]} Array of tokens
     * @private
     */
    _parseTokens() {
        if (process.env.TOKENS) {
            return process.env.TOKENS.split(',')
                .map(t => t.trim())
                .filter(Boolean);
        }

        // Legacy format fallback
        const tokens = [];
        let i = 1;
        while (process.env[`USER_TOKEN_${i}`]) {
            tokens.push(process.env[`USER_TOKEN_${i}`]);
            i++;
        }
        return tokens;
    }

    /**
     * Parse and validate the OWO ID
     * Handles scientific notation issues from YAML parsing
     * @returns {string} The OWO ID
     * @private
     */
    _parseOwoId() {
        const rawId = process.env.OWO_ID;
        
        // Return default if not provided
        if (!rawId) return DEFAULTS.OWO_ID;

        // Check if it's a valid numeric string
        if (!/^\d+$/.test(String(rawId))) {
            console.warn(`⚠️  ConfigManager: OWO_ID "${rawId}" is not valid numeric string. Using default.`);
            return DEFAULTS.OWO_ID;
        }

        return rawId;
    }

    /**
     * Load configuration from environment variables
     * @returns {Object} Configuration object
     * @private
     */
    _loadFromEnv() {
        return {
            tokens: this._parseTokens(),
            discordBotToken: process.env.DISCORD_BOT_TOKEN || null,
            CH_IDS: (process.env.CHANNEL_IDS || '').split(',').map(id => id.trim()).filter(Boolean),
            owo_ID: this._parseOwoId(),
            telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || null,
            telegramChatId: process.env.TELEGRAM_CHAT_ID || null,
            DEFAULT_PRESENCE: process.env.DEFAULT_PRESENCE || DEFAULTS.PRESENCE,
            enableConsoleLog: process.env.ENABLE_CONSOLE_LOG === 'true'
        };
    }

    /**
     * Validates the configuration object
     * @param {Object} config - Configuration object to validate
     * @returns {{valid: boolean, errors: string[]}} Validation result
     */
    validateConfig(config) {
        const errors = [];

        // 1. Validate Tokens
        if (!Array.isArray(config.tokens) || config.tokens.length === 0) {
            errors.push('At least one user token is required in TOKENS environment variable');
        } else {
            config.tokens.forEach((token, index) => {
                if (token.includes('YOUR_') || token === 'your_token_here') {
                    errors.push(`Token at index ${index} is a placeholder.`);
                }
            });
        }

        // 2. Validate OWO ID
        if (!/^\d+$/.test(config.owo_ID)) {
            errors.push('OWO_ID must be numeric');
        }

        // 3. Validate Channel IDs
        if (!Array.isArray(config.CH_IDS)) {
            errors.push('CHANNEL_IDS must be an array');
        } else {
            config.CH_IDS.forEach((id, index) => {
                if (!/^\d+$/.test(id)) {
                    errors.push(`Channel ID at index ${index} must be numeric`);
                }
            });
        }

        // 4. Validate Telegram Config (Dependency Check)
        if ((config.telegramBotToken && !config.telegramChatId) || (!config.telegramBotToken && config.telegramChatId)) {
            errors.push('Both TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required if one is provided');
        }

        // 5. Validate Presence
        if (config.DEFAULT_PRESENCE && !VALID_PRESENCES.includes(config.DEFAULT_PRESENCE)) {
            errors.push(`DEFAULT_PRESENCE must be one of: ${VALID_PRESENCES.join(', ')}`);
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Get configuration with sensitive data redacted
     * @returns {Object|null} Sanitized configuration object
     */
    getSecureConfig() {
        if (!this.config) return null;

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

    /**
     * Get OWO bot ID from configuration
     * @returns {string} OWO bot ID
     */
    getOwoId() {
        if (!this.config) return DEFAULTS.OWO_ID;
        return this.config.owo_ID || DEFAULTS.OWO_ID;
    }
}

module.exports = new ConfigManager();
