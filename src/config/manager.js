/**
 * Configuration Manager
 *
 * Handles loading, validation, and management of application configuration
 * from environment variables.
 *
 * @module config/manager
 */

const dotenv = require('dotenv');
const { DISCORD, VALIDATION } = require('./constants');

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default configuration values used when environment variables are not set
 */
const DEFAULT_CONFIG = {
    tokens: [],
    discordBotToken: null,
    CH_IDS: [],
    GIVEAWAY_CHANNEL_IDS: [],
    owo_ID: DISCORD.OWO_BOT_ID,
    telegramBotToken: null,
    telegramChatId: null,
    enableConsoleLog: false
};

/**
 * Placeholder patterns that indicate configuration values need to be replaced
 */
const PLACEHOLDER_PATTERNS = VALIDATION.PLACEHOLDER_PATTERNS;

/**
 * Regular expression for validating Discord IDs (should be numeric)
 */
const DISCORD_ID_REGEX = VALIDATION.DISCORD_ID_REGEX;

/**
 * Minimum length for a valid Discord token
 */
const MIN_TOKEN_LENGTH = DISCORD.MIN_TOKEN_LENGTH;

// ============================================================================
// CONFIGURATION MANAGER CLASS
// ============================================================================

/**
 * Configuration Manager class
 *
 * Manages application configuration loading from environment variables,
 * validation, and provides secure access to configuration values.
 */
class ConfigManager {
    constructor() {
        /** @type {Object|null} The loaded configuration object */
        this.config = null;

        /** @type {boolean} Whether configuration has been loaded */
        this.isLoaded = false;
    }

    /**
     * Load configuration from environment variables
     *
     * Loads environment variables from .env file and constructs the
     * configuration object. Validates the configuration before returning.
     *
     * @returns {Promise<Object>} Configuration object
     * @throws {Error} If configuration validation fails
     */
    async loadConfig() {
        // Load environment variables from .env file
        dotenv.config();

        if (this.config?.enableConsoleLog !== false) {
            console.log('[CONFIG] Loading configuration from .env...');
        }
        this.config = this._loadFromEnvironment();

        // Validate configuration
        const validation = this.validateConfig(this.config);
        if (!validation.valid) {
            throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
        }

        this.isLoaded = true;
        if (this.config?.enableConsoleLog !== false) {
            console.log('[CONFIG] Configuration loaded successfully');
        }
        return this.config;
    }

    /**
     * Parse configuration from environment variables
     *
     * @private
     * @returns {Object} Configuration object
     */
    _loadFromEnvironment() {
        return {
            tokens: this._parseTokens(),
            discordBotToken: process.env.DISCORD_BOT_TOKEN || null,
            CH_IDS: this._parseChannelIds(),
            GIVEAWAY_CHANNEL_IDS: this._parseGiveawayChannelIds(),
            owo_ID: this._parseOwoId(),
            telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || null,
            telegramChatId: process.env.TELEGRAM_CHAT_ID || null,
            enableConsoleLog: this._parseBoolean(process.env.ENABLE_CONSOLE_LOG, false)
        };
    }

    /**
     * Parse user tokens from environment variables
     *
     * Supports two formats:
     * 1. New format: TOKENS="token1,token2,token3"
     * 2. Legacy format: USER_TOKEN_1, USER_TOKEN_2, etc.
     *
     * @private
     * @returns {string[]} Array of user tokens
     */
    _parseTokens() {
        let tokens = [];

        // Try new format first
        if (process.env.TOKENS) {
            tokens = process.env.TOKENS
                .split(',')
                .map(token => token.trim())
                .filter(token => token.length > 0);
        } else {
            // Fallback to legacy format
            let index = 1;
            while (process.env[`USER_TOKEN_${index}`]) {
                tokens.push(process.env[`USER_TOKEN_${index}`]);
                index++;
            }
        }

        return tokens;
    }

    /**
     * Parse channel IDs from environment variables
     *
     * @private
     * @returns {string[]} Array of channel IDs
     */
    _parseChannelIds() {
        if (!process.env.CHANNEL_IDS) {
            return [];
        }

        return process.env.CHANNEL_IDS
            .split(',')
            .map(id => id.trim())
            .filter(id => id.length > 0);
    }

    _parseGiveawayChannelIds() {
        if (!process.env.GIVEAWAY_CHANNEL_IDS) {
            return [];
        }

        return process.env.GIVEAWAY_CHANNEL_IDS
            .split(',')
            .map(id => id.trim())
            .filter(id => id.length > 0);
    }

    /**
     * Parse OWO bot ID from environment variables
     *
     * Handles potential scientific notation issues from YAML parsing.
     *
     * @private
     * @returns {string} OWO bot ID
     */
    _parseOwoId() {
        let owoId = process.env.OWO_ID;

        // If provided but not purely numeric (e.g. scientific notation), fallback to default
        if (owoId && !DISCORD_ID_REGEX.test(String(owoId))) {
            if (this.config?.enableConsoleLog !== false) {
                console.warn(
                    `[CONFIG] OWO_ID "${owoId}" is not a valid numeric string. ` +
                    `Using default ID instead: ${DEFAULT_CONFIG.owo_ID}`
                );
            }
            owoId = DEFAULT_CONFIG.owo_ID;
        } else {
            owoId = owoId || DEFAULT_CONFIG.owo_ID;
        }

        return owoId;
    }

    /**
     * Parse a boolean environment variable
     *
     * @private
     * @param {string|undefined} value - Environment variable value
     * @param {boolean} defaultValue - Default value if not set
     * @returns {boolean} Parsed boolean value
     */
    _parseBoolean(value, defaultValue) {
        if (value === undefined || value === null) {
            return defaultValue;
        }

        return value === 'true' || value === '1' || value === 'yes';
    }

    /**
     * Validate the configuration object
     *
     * @param {Object} config - Configuration object to validate
     * @returns {Object} Validation result with valid flag and errors array
     */
    validateConfig(config) {
        const errors = [];

        // Validate tokens
        this._validateTokens(config, errors);

        // Validate bot token (optional)
        this._validateBotToken(config, errors);

        // Validate channel IDs (optional)
        this._validateChannelIds(config, errors);

        // Validate OWO ID
        this._validateOwoId(config, errors);

        // Validate console log flag
        this._validateConsoleLog(config, errors);

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate user tokens
     *
     * @private
     * @param {Object} config - Configuration object
     * @param {string[]} errors - Array to collect validation errors
     */
    _validateTokens(config, errors) {
        if (!Array.isArray(config.tokens)) {
            errors.push('tokens must be an array');
            return;
        }

        if (config.tokens.length === 0) {
            errors.push('At least one user token is required in TOKENS environment variable');
            return;
        }

        config.tokens.forEach((token, index) => {
            if (typeof token !== 'string' || !token.trim()) {
                errors.push(`Token at index ${index} is invalid`);
            } else if (token.length < MIN_TOKEN_LENGTH) {
                errors.push(`Token at index ${index} is too short (minimum ${MIN_TOKEN_LENGTH} characters)`);
            } else if (this._isPlaceholder(token)) {
                errors.push(`Token at index ${index} is a placeholder. Please replace with actual token`);
            }
        });
    }

    /**
     * Validate Discord bot token
     *
     * @private
     * @param {Object} config - Configuration object
     * @param {string[]} errors - Array to collect validation errors
     */
    _validateBotToken(config, errors) {
        if (!config.discordBotToken) {
            return; // Bot token is optional
        }

        if (typeof config.discordBotToken !== 'string' || !config.discordBotToken.trim()) {
            errors.push('DISCORD_BOT_TOKEN must be a non-empty string');
        } else if (config.discordBotToken.length < MIN_TOKEN_LENGTH) {
            errors.push(`DISCORD_BOT_TOKEN is too short (minimum ${MIN_TOKEN_LENGTH} characters)`);
        } else if (this._isPlaceholder(config.discordBotToken)) {
            errors.push('DISCORD_BOT_TOKEN is a placeholder. Please replace with actual token or remove it');
        }
    }

    /**
     * Validate channel IDs
     *
     * @private
     * @param {Object} config - Configuration object
     * @param {string[]} errors - Array to collect validation errors
     */
    _validateChannelIds(config, errors) {
        if (!Array.isArray(config.CH_IDS)) {
            errors.push('CHANNEL_IDS must be an array');
            return;
        }

        if (config.CH_IDS.length === 0) {
            return; // Empty array is valid
        }

        config.CH_IDS.forEach((channelId, index) => {
            if (typeof channelId !== 'string' || !channelId.trim()) {
                errors.push(`Channel ID at index ${index} is invalid`);
            } else if (!DISCORD_ID_REGEX.test(channelId)) {
                errors.push(`Channel ID at index ${index} must be numeric`);
            }
        });
    }

    /**
     * Validate OWO bot ID
     *
     * @private
     * @param {Object} config - Configuration object
     * @param {string[]} errors - Array to collect validation errors
     */
    _validateOwoId(config, errors) {
        if (!config.owo_ID || typeof config.owo_ID !== 'string') {
            errors.push('OWO_ID must be a non-empty string');
        } else if (!DISCORD_ID_REGEX.test(config.owo_ID)) {
            errors.push('OWO_ID must be numeric');
        }
    }

    /**
     * Validate console log flag
     *
     * @private
     * @param {Object} config - Configuration object
     * @param {string[]} errors - Array to collect validation errors
     */
    _validateConsoleLog(config, errors) {
        if (config.enableConsoleLog !== undefined && typeof config.enableConsoleLog !== 'boolean') {
            errors.push('ENABLE_CONSOLE_LOG must be true or false');
        }
    }

    /**
     * Check if a value appears to be a placeholder
     *
     * @private
     * @param {string} value - Value to check
     * @returns {boolean} True if value is a placeholder
     */
    _isPlaceholder(value) {
        return PLACEHOLDER_PATTERNS.some(pattern => value.includes(pattern));
    }

    /**
     * Get configuration with sensitive data sanitized for logging
     *
     * Returns a copy of the configuration with all sensitive values
     * (tokens, bot tokens, chat IDs) replaced with '[REDACTED]'.
     *
     * @returns {Object|null} Sanitized configuration object, or null if not loaded
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
     * Get the current configuration object
     *
     * @returns {Object|null} Configuration object, or null if not loaded
     */
    getConfig() {
        return this.config;
    }

    /**
     * Check if configuration has been loaded
     *
     * @returns {boolean} True if configuration is loaded
     */
    isConfigLoaded() {
        return this.isLoaded;
    }

    /**
     * Reload configuration from environment variables
     *
     * Useful for runtime configuration updates (if needed in the future).
     *
     * @returns {Promise<Object>} Reloaded configuration object
     */
    async reloadConfig() {
        if (this.config?.enableConsoleLog !== false) {
            console.log('[CONFIG] Reloading configuration...');
        }
        return this.loadConfig();
    }
}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

module.exports = new ConfigManager();
