const dotenv = require('dotenv');

// Default configuration values
const DEFAULT_CONFIG = {
    discordBotToken: null,
    owo_ID: '408785106942164992',
    DEFAULT_PRESENCE: 'invisible',
    enableConsoleLog: false
};

// Valid presence options
const VALID_PRESENCES = ['invisible', 'online', 'idle', 'dnd'];

// Token pattern for Discord tokens (starts with MOTA, MTE, etc.)
const DISCORD_TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,}$/;

/**
 * Configuration Manager
 * Handles loading, validation, and management of application configuration from .env file
 */
class ConfigManager {
    constructor() {
        this.config = null;
    }

    /**
     * Load configuration from environment variables (.env file)
     * @returns {Promise<Object>} Configuration object
     */
    async loadConfig() {
        dotenv.config();
        this.config = this._loadFromEnv();
        this._validateConfig();
        return this.config;
    }

    /**
     * Parse comma-separated list from environment variable
     * @param {string} envVar - Environment variable name
     * @returns {Array<string>} Parsed array
     * @private
     */
    _parseCommaSeparated(envVar) {
        if (!process.env[envVar]) return [];
        return process.env[envVar].split(',')
            .map(item => item.trim())
            .filter(item => item.length > 0);
    }

    /**
     * Load configuration from environment variables
     * @returns {Object} Configuration object
     * @private
     */
    _loadFromEnv() {
        return {
            tokens: this._parseCommaSeparated('TOKENS'),
            discordBotToken: process.env.DISCORD_BOT_TOKEN || DEFAULT_CONFIG.discordBotToken,
            CH_IDS: this._parseCommaSeparated('CHANNEL_IDS'),
            owo_ID: process.env.OWO_ID || DEFAULT_CONFIG.owo_ID,
            DEFAULT_PRESENCE: process.env.DEFAULT_PRESENCE || DEFAULT_CONFIG.DEFAULT_PRESENCE,
            enableConsoleLog: process.env.ENABLE_CONSOLE_LOG === 'true'
        };
    }

    /**
     * Validate array of strings
     * @param {Array} arr - Array to validate
     * @param {string} name - Name for error messages
     * @param {Array} errors - Errors array to append to
     * @returns {boolean} Valid
     * @private
     */
    _validateStringArray(arr, name, errors) {
        if (!Array.isArray(arr)) {
            errors.push(`${name} must be an array`);
            return false;
        }
        if (arr.length === 0) {
            errors.push(`${name} must not be empty`);
            return false;
        }
        arr.forEach((item, index) => {
            if (typeof item !== 'string' || !item.trim()) {
                errors.push(`${name} at index ${index} is invalid`);
            }
        });
        return true;
    }

    /**
     * Validate configuration
     * @throws {Error} If configuration is invalid
     * @private
     */
    _validateConfig() {
        const errors = [];

        // Validate tokens
        this._validateStringArray(this.config.tokens, 'tokens', errors);

        // Validate bot token (optional)
        if (this.config.discordBotToken && typeof this.config.discordBotToken !== 'string') {
            errors.push('discordBotToken must be a string');
        }

        // Validate channel IDs (optional)
        if (this.config.CH_IDS.length > 0) {
            this._validateStringArray(this.config.CH_IDS, 'CH_IDS', errors);
        }

        // Validate OWO ID
        if (!this.config.owo_ID || typeof this.config.owo_ID !== 'string') {
            errors.push('owo_ID must be a non-empty string');
        }

        // Validate presence
        if (this.config.DEFAULT_PRESENCE && !VALID_PRESENCES.includes(this.config.DEFAULT_PRESENCE)) {
            errors.push(`DEFAULT_PRESENCE must be one of: ${VALID_PRESENCES.join(', ')}`);
        }

        // Validate console log flag
        if (this.config.enableConsoleLog !== undefined && typeof this.config.enableConsoleLog !== 'boolean') {
            errors.push('enableConsoleLog must be a boolean');
        }

        if (errors.length > 0) {
            throw new Error(`Configuration validation failed: ${errors.join('; ')}`);
        }
    }

    /**
     * Get configuration with sensitive data sanitized for logging
     * @returns {Object} Sanitized configuration object
     */
    getSecureConfig() {
        if (!this.config) return null;

        return {
            ...this.config,
            tokens: this.config.tokens.map(() => '[REDACTED]'),
            discordBotToken: this.config.discordBotToken ? '[REDACTED]' : undefined
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
     * Reload configuration
     * @returns {Promise<Object>} New configuration object
     */
    async reloadConfig() {
        this.config = null;
        return this.loadConfig();
    }
}

module.exports = new ConfigManager();