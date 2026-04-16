/**
 * Event System Module
 *
 * Central event system for the application.
 *
 * @module core/events
 */

const { EventTypes, EventPriority, EventCategories } = require('./types');
const { EventBus, EventHandler, globalEventBus } = require('./eventBus');

// ============================================================================
// EVENT SYSTEM CLASS
// ============================================================================

/**
 * Event System
 *
 * Provides a unified interface for event management
 * with convenience methods for common operations.
 */
class EventSystem {
    constructor() {
        /** @type {EventBus} Event bus instance */
        this.eventBus = globalEventBus;
    }

    /**
     * Register an event handler
     * @param {string} eventType - Event type
     * @param {Function} handler - Handler function
     * @param {Object} options - Handler options
     * @returns {Function} Unregister function
     */
    on(eventType, handler, options = {}) {
        return this.eventBus.on(eventType, handler, options);
    }

    /**
     * Register a one-time event handler
     * @param {string} eventType - Event type
     * @param {Function} handler - Handler function
     * @param {Object} options - Handler options
     * @returns {Function} Unregister function
     */
    once(eventType, handler, options = {}) {
        return this.eventBus.once(eventType, handler, options);
    }

    /**
     * Unregister an event handler
     * @param {string} eventType - Event type
     * @param {string} handlerId - Handler ID
     * @returns {boolean} Whether handler was unregistered
     */
    off(eventType, handlerId) {
        return this.eventBus.off(eventType, handlerId);
    }

    /**
     * Unregister all handlers for an event type
     * @param {string} eventType - Event type
     * @returns {number} Number of handlers unregistered
     */
    offAll(eventType) {
        return this.eventBus.offAll(eventType);
    }

    /**
     * Emit an event
     * @param {string} eventType - Event type
     * @param {*} data - Event data
     * @returns {Promise<Array>} Array of handler results
     */
    async emit(eventType, data = null) {
        return this.eventBus.emit(eventType, data);
    }

    /**
     * Emit an event synchronously
     * @param {string} eventType - Event type
     * @param {*} data - Event data
     * @returns {Array} Array of handler results
     */
    emitSync(eventType, data = null) {
        return this.eventBus.emitSync(eventType, data);
    }

    /**
     * Get event bus statistics
     * @returns {Object} Event bus statistics
     */
    getStats() {
        return this.eventBus.getStats();
    }

    /**
     * Get event history
     * @param {number} limit - Maximum number of events
     * @returns {Array} Event history
     */
    getHistory(limit = 10) {
        return this.eventBus.getHistory(limit);
    }

    /**
     * Clear event history
     */
    clearHistory() {
        this.eventBus.clearHistory();
    }

    /**
     * Pause event system
     */
    pause() {
        this.eventBus.pause();
    }

    /**
     * Resume event system
     */
    resume() {
        this.eventBus.resume();
    }

    /**
     * Clear all handlers
     */
    clear() {
        this.eventBus.clear();
    }

    /**
     * Destroy event system
     */
    destroy() {
        this.eventBus.destroy();
    }

    // ============================================================================
    // CONVENIENCE METHODS FOR COMMON EVENTS
    // ============================================================================

    /**
     * Emit farming started event
     * @param {Object} data - Farming data
     * @returns {Promise<Array>} Handler results
     */
    async emitFarmingStarted(data) {
        return this.emit(EventTypes.FARMING_STARTED, data);
    }

    /**
     * Emit farming stopped event
     * @param {Object} data - Farming data
     * @returns {Promise<Array>} Handler results
     */
    async emitFarmingStopped(data) {
        return this.emit(EventTypes.FARMING_STOPPED, data);
    }

    /**
     * Emit CAPTCHA detected event
     * @param {Object} data - CAPTCHA data
     * @returns {Promise<Array>} Handler results
     */
    async emitCaptchaDetected(data) {
        return this.emit(EventTypes.CAPTCHA_DETECTED, data);
    }

    /**
     * Emit CAPTCHA solved event
     * @param {Object} data - CAPTCHA data
     * @returns {Promise<Array>} Handler results
     */
    async emitCaptchaSolved(data) {
        return this.emit(EventTypes.CAPTCHA_SOLVED, data);
    }

    /**
     * Emit giveaway detected event
     * @param {Object} data - Giveaway data
     * @returns {Promise<Array>} Handler results
     */
    async emitGiveawayDetected(data) {
        return this.emit(EventTypes.GIVEAWAY_DETECTED, data);
    }

    /**
     * Emit giveaway joined event
     * @param {Object} data - Giveaway data
     * @returns {Promise<Array>} Handler results
     */
    async emitGiveawayJoined(data) {
        return this.emit(EventTypes.GIVEAWAY_JOINED, data);
    }

    /**
     * Emit bot ready event
     * @param {Object} data - Bot data
     * @returns {Promise<Array>} Handler results
     */
    async emitBotReady(data) {
        return this.emit(EventTypes.BOT_READY, data);
    }

    /**
     * Emit bot error event
     * @param {Object} data - Error data
     * @returns {Promise<Array>} Handler results
     */
    async emitBotError(data) {
        return this.emit(EventTypes.BOT_ERROR, data);
    }

    /**
     * Emit command received event
     * @param {Object} data - Command data
     * @returns {Promise<Array>} Handler results
     */
    async emitCommandReceived(data) {
        return this.emit(EventTypes.COMMAND_RECEIVED, data);
    }

    /**
     * Emit command result event
     * @param {Object} data - Command result data
     * @returns {Promise<Array>} Handler results
     */
    async emitCommandResult(data) {
        return this.emit(EventTypes.COMMAND_RESULT, data);
    }
}

// ============================================================================
// GLOBAL EVENT SYSTEM INSTANCE
// ============================================================================

/**
 * Global event system instance
 * @type {EventSystem}
 */
const eventSystem = new EventSystem();

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    // Event system
    EventSystem,
    eventSystem,

    // Event bus
    EventBus,
    EventHandler,
    globalEventBus,

    // Event types
    EventTypes,
    EventPriority,
    EventCategories
};
