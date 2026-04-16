/**
 * Captcha Service Module
 *
 * Handles CAPTCHA detection and management including:
 * - CAPTCHA keyword detection
 * - CAPTCHA webhook message management
 * - CAPTCHA DM handler management
 *
 * @module services/captchaService
 */

const { stateManager } = require('../core/state');
const { Loggers } = require('../utils/logger');
const { CAPTCHA, FARMING } = require('../config/constants');

// ============================================================================
// CAPTCHA SERVICE CLASS
// ============================================================================

/**
 * Captcha Service
 *
 * Manages all CAPTCHA-related operations including:
 * - CAPTCHA detection from messages
 * - CAPTCHA webhook message tracking
 * - CAPTCHA DM handler management
 * - CAPTCHA status management
 */
class CaptchaService {
    constructor() {
        /** @type {Object} Service configuration */
        this.config = {
            keywords: CAPTCHA.KEYWORDS,
            webhookDeleteDelay: FARMING.CAPTCHA_WEBHOOK_DELETE_DELAY
        };
    }

    /**
     * Check if message contains CAPTCHA keywords
     * @param {string} content - Message content to check
     * @returns {boolean} Whether message contains CAPTCHA keywords
     */
    containsCaptchaKeywords(content) {
        if (!content || typeof content !== 'string') {
            return false;
        }

        const lowerContent = content.toLowerCase();
        return this.config.keywords.some(keyword =>
            lowerContent.includes(keyword)
        );
    }

    /**
     * Check if CAPTCHA is detected
     * @returns {boolean} Whether CAPTCHA is detected
     */
    isDetected() {
        return stateManager.captcha.isDetected();
    }

    /**
     * Set CAPTCHA detected status
     * @param {boolean} detected - Whether CAPTCHA is detected
     */
    setDetected(detected) {
        stateManager.captcha.setDetected(detected);

        if (detected) {
            Loggers.Captcha.info('CAPTCHA detected');
        }
    }

    /**
     * Check if CAPTCHA DM handler is enabled
     * @returns {boolean} Whether CAPTCHA DM handler is enabled
     */
    isDmHandlerEnabled() {
        return stateManager.captcha.isDmHandlerEnabled();
    }

    /**
     * Set CAPTCHA DM handler enabled status
     * @param {boolean} enabled - Whether CAPTCHA DM handler should be enabled
     */
    setDmHandlerEnabled(enabled) {
        stateManager.captcha.setDmHandlerEnabled(enabled);

        const status = enabled ? 'enabled' : 'disabled';
        Loggers.Captcha.info(`CAPTCHA DM handler ${status}`);
    }

    /**
     * Toggle CAPTCHA DM handler enabled status
     * @returns {boolean} New enabled status
     */
    toggleDmHandlerEnabled() {
        const enabled = stateManager.captcha.toggleDmHandlerEnabled();
        const status = enabled ? 'enabled' : 'disabled';
        Loggers.Captcha.info(`CAPTCHA DM handler ${status}`);
        return enabled;
    }

    /**
     * Get CAPTCHA webhook messages
     * @returns {Array} Array of CAPTCHA webhook messages
     */
    getWebhookMessages() {
        return stateManager.captcha.getWebhookMessages();
    }

    /**
     * Add a CAPTCHA webhook message
     * @param {Object} message - Webhook message to add
     */
    addWebhookMessage(message) {
        stateManager.captcha.addWebhookMessage(message);
        Loggers.Captcha.debug(`CAPTCHA webhook message added: ${message.id}`);
    }

    /**
     * Remove a CAPTCHA webhook message
     * @param {string} messageId - Message ID to remove
     * @returns {boolean} Whether message was removed
     */
    removeWebhookMessage(messageId) {
        const removed = stateManager.captcha.removeWebhookMessage(messageId);
        if (removed) {
            Loggers.Captcha.debug(`CAPTCHA webhook message removed: ${messageId}`);
        }
        return removed;
    }

    /**
     * Clear all CAPTCHA webhook messages
     */
    clearWebhookMessages() {
        stateManager.captcha.clearWebhookMessages();
        Loggers.Captcha.debug('All CAPTCHA webhook messages cleared');
    }

    /**
     * Get CAPTCHA webhook delete timer
     * @returns {Timeout|null} The delete timer or null
     */
    getWebhookDeleteTimer() {
        return stateManager.captcha.getWebhookDeleteTimer();
    }

    /**
     * Set CAPTCHA webhook delete timer
     * @param {Timeout|null} timer - The delete timer or null
     */
    setWebhookDeleteTimer(timer) {
        stateManager.captcha.setWebhookDeleteTimer(timer);
    }

    /**
     * Clear CAPTCHA webhook delete timer
     */
    clearWebhookDeleteTimer() {
        stateManager.captcha.clearWebhookDeleteTimer();
        Loggers.Captcha.debug('CAPTCHA webhook delete timer cleared');
    }

    /**
     * Schedule CAPTCHA webhook message deletion
     * @param {Function} deleteFn - Function to delete the message
     * @returns {Timeout} The timer for the scheduled deletion
     */
    scheduleWebhookDeletion(deleteFn) {
        // Clear existing timer
        this.clearWebhookDeleteTimer();

        // Set new timer
        const timer = setTimeout(() => {
            try {
                deleteFn();
                Loggers.Captcha.info('CAPTCHA webhook message deleted');
            } catch (error) {
                Loggers.Captcha.error(`Error deleting CAPTCHA webhook message: ${error.message}`);
            }
            this.clearWebhookDeleteTimer();
        }, this.config.webhookDeleteDelay);

        this.setWebhookDeleteTimer(timer);
        return timer;
    }

    /**
     * Check if bot should stop due to CAPTCHA
     * @returns {boolean} Whether bot should stop
     */
    shouldStopBot() {
        return stateManager.captcha.shouldStopBot();
    }

    /**
     * Reset CAPTCHA state
     */
    reset() {
        stateManager.captcha.reset();
        Loggers.Captcha.info('CAPTCHA state reset');
    }

    /**
     * Get CAPTCHA statistics
     * @returns {Object} CAPTCHA statistics
     */
    getStats() {
        return {
            detected: this.isDetected(),
            dmHandlerEnabled: this.isDmHandlerEnabled(),
            webhookMessagesCount: this.getWebhookMessages().length,
            hasDeleteTimer: this.getWebhookDeleteTimer() !== null
        };
    }
}

// ============================================================================
// GLOBAL CAPTCHA SERVICE INSTANCE
// ============================================================================

/**
 * Global CAPTCHA service instance
 * @type {CaptchaService}
 */
const captchaService = new CaptchaService();

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    CaptchaService,
    captchaService
};
