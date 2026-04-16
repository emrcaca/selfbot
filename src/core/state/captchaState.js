/**
 * Captcha State Module
 *
 * Manages state related to CAPTCHA detection and handling including
 * CAPTCHA status, webhook messages, and DM handler status.
 *
 * @module core/state/captchaState
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default CAPTCHA state values
 */
const DEFAULT_CAPTCHA_STATE = {
    captchaDetected: false,
    isCaptchaDmHandlerEnabled: true,
    captchaWebhookMessages: [],
    captchaWebhookDeleteTimer: null
};

/**
 * Keywords used to detect CAPTCHA messages
 */
const CAPTCHA_KEYWORDS = [
    'captcha',
    'verify',
    'real',
    'human?',
    'ban',
    'banned',
    'suspend',
    'complete verification'
];

// ============================================================================
// CAPTCHA STATE CLASS
// ============================================================================

/**
 * CAPTCHA State Manager
 *
 * Manages all CAPTCHA-related state including:
 * - CAPTCHA detection status
 * - CAPTCHA DM handler status
 * - CAPTCHA webhook messages tracking
 * - CAPTCHA webhook delete timer
 */
class CaptchaState {
    constructor() {
        /** @type {Object} The CAPTCHA state object */
        this.state = { ...DEFAULT_CAPTCHA_STATE };
    }

    /**
     * Get the current CAPTCHA state
     * @returns {Object} Copy of the CAPTCHA state
     */
    getState() {
        return { ...this.state };
    }

    /**
     * Set the CAPTCHA state
     * @param {Object} newState - New state values to merge
     */
    setState(newState) {
        this.state = { ...this.state, ...newState };
    }

    /**
     * Reset CAPTCHA state to default values
     */
    reset() {
        this.state = { ...DEFAULT_CAPTCHA_STATE };
    }

    /**
     * Check if CAPTCHA has been detected
     * @returns {boolean} Whether CAPTCHA is detected
     */
    isDetected() {
        return this.state.captchaDetected;
    }

    /**
     * Set CAPTCHA detected status
     * @param {boolean} detected - Whether CAPTCHA is detected
     */
    setDetected(detected) {
        this.state.captchaDetected = detected;
    }

    /**
     * Check if CAPTCHA DM handler is enabled
     * @returns {boolean} Whether CAPTCHA DM handler is enabled
     */
    isDmHandlerEnabled() {
        return this.state.isCaptchaDmHandlerEnabled;
    }

    /**
     * Set CAPTCHA DM handler enabled status
     * @param {boolean} enabled - Whether CAPTCHA DM handler should be enabled
     */
    setDmHandlerEnabled(enabled) {
        this.state.isCaptchaDmHandlerEnabled = enabled;
    }

    /**
     * Toggle CAPTCHA DM handler enabled status
     * @returns {boolean} New enabled status
     */
    toggleDmHandlerEnabled() {
        this.state.isCaptchaDmHandlerEnabled = !this.state.isCaptchaDmHandlerEnabled;
        return this.state.isCaptchaDmHandlerEnabled;
    }

    /**
     * Get CAPTCHA webhook messages
     * @returns {Array} Array of CAPTCHA webhook messages
     */
    getWebhookMessages() {
        return [...this.state.captchaWebhookMessages];
    }

    /**
     * Add a CAPTCHA webhook message
     * @param {Object} message - Webhook message to add
     */
    addWebhookMessage(message) {
        this.state.captchaWebhookMessages.push(message);
    }

    /**
     * Remove a CAPTCHA webhook message
     * @param {string} messageId - Message ID to remove
     * @returns {boolean} Whether message was removed
     */
    removeWebhookMessage(messageId) {
        const index = this.state.captchaWebhookMessages.findIndex(
            msg => msg.id === messageId
        );
        if (index !== -1) {
            this.state.captchaWebhookMessages.splice(index, 1);
            return true;
        }
        return false;
    }

    /**
     * Clear all CAPTCHA webhook messages
     */
    clearWebhookMessages() {
        this.state.captchaWebhookMessages = [];
    }

    /**
     * Get CAPTCHA webhook delete timer
     * @returns {Timeout|null} The delete timer or null
     */
    getWebhookDeleteTimer() {
        return this.state.captchaWebhookDeleteTimer;
    }

    /**
     * Set CAPTCHA webhook delete timer
     * @param {Timeout|null} timer - The delete timer or null
     */
    setWebhookDeleteTimer(timer) {
        this.state.captchaWebhookDeleteTimer = timer;
    }

    /**
     * Clear CAPTCHA webhook delete timer
     */
    clearWebhookDeleteTimer() {
        if (this.state.captchaWebhookDeleteTimer) {
            clearTimeout(this.state.captchaWebhookDeleteTimer);
            this.state.captchaWebhookDeleteTimer = null;
        }
    }

    /**
     * Check if message contains CAPTCHA keywords
     * @param {string} content - Message content to check
     * @returns {boolean} Whether message contains CAPTCHA keywords
     */
    containsCaptchaKeywords(content) {
        const lowerContent = content.toLowerCase();
        return CAPTCHA_KEYWORDS.some(keyword =>
            lowerContent.includes(keyword)
        );
    }

    /**
     * Check if bot should stop due to CAPTCHA
     * @returns {boolean} Whether bot should stop
     */
    shouldStopBot() {
        return this.state.captchaDetected;
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    DEFAULT_CAPTCHA_STATE,
    CAPTCHA_KEYWORDS,
    CaptchaState
};
