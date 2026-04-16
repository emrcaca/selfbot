/**
 * Event Bus Module
 *
 * Provides a centralized event system for application-wide
 * event handling and communication.
 *
 * @module core/events/eventBus
 */

const { EventTypes, EventPriority } = require('./types');

// ============================================================================
// EVENT HANDLER CLASS
// ============================================================================

/**
 * Event Handler
 *
 * Represents a single event handler with metadata.
 */
class EventHandler {
    /**
     * @param {Function} handler - Handler function
     * @param {Object} options - Handler options
     * @param {boolean} options.once - Whether handler should run only once
     * @param {number} options.priority - Handler priority
     * @param {string} options.id - Handler ID
     */
    constructor(handler, options = {}) {
        this.handler = handler;
        this.once = options.once || false;
        this.priority = options.priority !== undefined ? options.priority : EventPriority.NORMAL;
        this.id = options.id || `handler_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.callCount = 0;
    }

    /**
     * Execute the handler
     * @param {*} data - Event data
     * @returns {*} Handler result
     */
    async execute(data) {
        this.callCount++;
        return await this.handler(data);
    }
}

// ============================================================================
// EVENT BUS CLASS
// ============================================================================

/**
 * Event Bus
 *
 * Provides a centralized event system with:
 * - Event registration and emission
 * - Priority-based handler execution
 * - Once-only handlers
 * - Async handler support
 * - Error handling
 * - Statistics tracking
 */
class EventBus {
    constructor() {
        /** @type {Map<string, Array<EventHandler>>} Event handlers */
        this.handlers = new Map();

        /** @type {Map<string, Array<EventHandler>>} Wildcard handlers */
        this.wildcardHandlers = [];

        /** @type {Object} Event bus statistics */
        this.stats = {
            eventsEmitted: 0,
            eventsHandled: 0,
            handlersRegistered: 0,
            handlersUnregistered: 0,
            errors: 0
        };

        /** @type {boolean} Whether event bus is paused */
        this.paused = false;

        /** @type {Array} Event history */
        this.history = [];
        /** @type {number} Maximum history size */
        this.maxHistorySize = 100;
    }

    /**
     * Register an event handler
     * @param {string} eventType - Event type
     * @param {Function} handler - Handler function
     * @param {Object} options - Handler options
     * @returns {Function} Unregister function
     */
    on(eventType, handler, options = {}) {
        if (!eventType || typeof eventType !== 'string') {
            throw new Error('Event type must be a non-empty string');
        }

        if (typeof handler !== 'function') {
            throw new Error('Handler must be a function');
        }

        const eventHandler = new EventHandler(handler, options);

        if (!this.handlers.has(eventType)) {
            this.handlers.set(eventType, []);
        }

        this.handlers.get(eventType).push(eventHandler);
        this.stats.handlersRegistered++;

        // Sort handlers by priority
        this.sortHandlers(eventType);

        // Return unregister function
        return () => this.off(eventType, eventHandler.id);
    }

    /**
     * Register a one-time event handler
     * @param {string} eventType - Event type
     * @param {Function} handler - Handler function
     * @param {Object} options - Handler options
     * @returns {Function} Unregister function
     */
    once(eventType, handler, options = {}) {
        return this.on(eventType, handler, { ...options, once: true });
    }

    /**
     * Unregister an event handler
     * @param {string} eventType - Event type
     * @param {string} handlerId - Handler ID
     * @returns {boolean} Whether handler was unregistered
     */
    off(eventType, handlerId) {
        const handlers = this.handlers.get(eventType);

        if (!handlers) {
            return false;
        }

        const index = handlers.findIndex(h => h.id === handlerId);

        if (index !== -1) {
            handlers.splice(index, 1);
            this.stats.handlersUnregistered++;

            // Clean up empty handler arrays
            if (handlers.length === 0) {
                this.handlers.delete(eventType);
            }

            return true;
        }

        return false;
    }

    /**
     * Unregister all handlers for an event type
     * @param {string} eventType - Event type
     * @returns {number} Number of handlers unregistered
     */
    offAll(eventType) {
        const handlers = this.handlers.get(eventType);

        if (!handlers) {
            return 0;
        }

        const count = handlers.length;
        this.handlers.delete(eventType);
        this.stats.handlersUnregistered += count;

        return count;
    }

    /**
     * Emit an event
     * @param {string} eventType - Event type
     * @param {*} data - Event data
     * @returns {Promise<Array>} Array of handler results
     */
    async emit(eventType, data = null) {
        if (this.paused) {
            return [];
        }

        this.stats.eventsEmitted++;

        // Add to history
        this.addToHistory(eventType, data);

        // Get handlers for this event type
        const handlers = this.handlers.get(eventType) || [];

        // Execute handlers
        const results = [];

        for (const handler of [...handlers]) {
            try {
                const result = await handler.execute(data);
                results.push(result);
                this.stats.eventsHandled++;

                // Remove once-only handlers
                if (handler.once) {
                    this.off(eventType, handler.id);
                }
            } catch (error) {
                this.stats.errors++;
                console.error(`Error in handler for event ${eventType}:`, error);
            }
        }

        return results;
    }

    /**
     * Emit an event synchronously
     * @param {string} eventType - Event type
     * @param {*} data - Event data
     * @returns {Array} Array of handler results
     */
    emitSync(eventType, data = null) {
        if (this.paused) {
            return [];
        }

        this.stats.eventsEmitted++;

        // Add to history
        this.addToHistory(eventType, data);

        // Get handlers for this event type
        const handlers = this.handlers.get(eventType) || [];

        // Execute handlers synchronously
        const results = [];

        for (const handler of [...handlers]) {
            try {
                const result = handler.execute(data);
                results.push(result);
                this.stats.eventsHandled++;

                // Remove once-only handlers
                if (handler.once) {
                    this.off(eventType, handler.id);
                }
            } catch (error) {
                this.stats.errors++;
                console.error(`Error in handler for event ${eventType}:`, error);
            }
        }

        return results;
    }

    /**
     * Sort handlers by priority
     * @param {string} eventType - Event type
     */
    sortHandlers(eventType) {
        const handlers = this.handlers.get(eventType);

        if (handlers) {
            handlers.sort((a, b) => a.priority - b.priority);
        }
    }

    /**
     * Add event to history
     * @param {string} eventType - Event type
     * @param {*} data - Event data
     */
    addToHistory(eventType, data) {
        this.history.push({
            type: eventType,
            data: data,
            timestamp: Date.now()
        });

        // Trim history if too large
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        }
    }

    /**
     * Get event history
     * @param {number} limit - Maximum number of events to return
     * @returns {Array} Event history
     */
    getHistory(limit = 10) {
        return this.history.slice(-limit);
    }

    /**
     * Clear event history
     */
    clearHistory() {
        this.history = [];
    }

    /**
     * Get handlers for an event type
     * @param {string} eventType - Event type
     * @returns {Array<EventHandler>} Array of handlers
     */
    getHandlers(eventType) {
        return this.handlers.get(eventType) || [];
    }

    /**
     * Get all event types with handlers
     * @returns {Array<string>} Array of event types
     */
    getEventTypes() {
        return Array.from(this.handlers.keys());
    }

    /**
     * Check if has handlers for an event type
     * @param {string} eventType - Event type
     * @returns {boolean} Whether has handlers
     */
    hasHandlers(eventType) {
        const handlers = this.handlers.get(eventType);
        return handlers && handlers.length > 0;
    }

    /**
     * Get event bus statistics
     * @returns {Object} Event bus statistics
     */
    getStats() {
        return {
            ...this.stats,
            eventTypes: this.getEventTypes().length,
            totalHandlers: Array.from(this.handlers.values())
                .reduce((sum, handlers) => sum + handlers.length, 0),
            paused: this.paused,
            historySize: this.history.length
        };
    }

    /**
     * Reset event bus statistics
     */
    resetStats() {
        this.stats = {
            eventsEmitted: 0,
            eventsHandled: 0,
            handlersRegistered: 0,
            handlersUnregistered: 0,
            errors: 0
        };
    }

    /**
     * Pause event bus
     */
    pause() {
        this.paused = true;
    }

    /**
     * Resume event bus
     */
    resume() {
        this.paused = false;
    }

    /**
     * Clear all handlers
     */
    clear() {
        this.handlers.clear();
        this.clearHistory();
    }

    /**
     * Destroy event bus and cleanup resources
     */
    destroy() {
        this.clear();
        this.resetStats();
    }
}

// ============================================================================
// GLOBAL EVENT BUS INSTANCE
// ============================================================================

/**
 * Global event bus instance
 * @type {EventBus}
 */
const globalEventBus = new EventBus();

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    EventBus,
    EventHandler,
    globalEventBus
};
