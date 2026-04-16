/**
 * Event Listener Manager Module
 *
 * Manages event listener tracking to prevent memory leaks
 * and ensure proper cleanup of event listeners.
 *
 * @module utils/managers/eventListenerManager
 */

// ============================================================================
// EVENT LISTENER MANAGER CLASS
// ============================================================================

/**
 * Event Listener Manager
 *
 * Tracks and manages all event listeners to prevent memory leaks
 * and ensure proper cleanup.
 */
class EventListenerManager {
    constructor() {
        /** @type {Map<string, Array<{target: EventEmitter, event: string, listener: Function}>>} Map of tracked listeners */
        this.listeners = new Map();
    }

    /**
     * Add an event listener with tracking
     * @param {EventEmitter} target - Event emitter target
     * @param {string} event - Event name
     * @param {Function} listener - Event listener function
     * @param {string} key - Unique key for tracking
     * @returns {Function} Function to remove the listener
     */
    addListener(target, event, listener, key) {
        // Add listener to target
        target.on(event, listener);

        // Track the listener
        if (!this.listeners.has(key)) {
            this.listeners.set(key, []);
        }

        this.listeners.get(key).push({
            target,
            event,
            listener
        });

        // Return function to remove listener
        return () => this.removeListener(key, target, event, listener);
    }

    /**
     * Add a one-time event listener with tracking
     * @param {EventEmitter} target - Event emitter target
     * @param {string} event - Event name
     * @param {Function} listener - Event listener function
     * @param {string} key - Unique key for tracking
     * @returns {Function} Function to remove the listener
     */
    addOnceListener(target, event, listener, key) {
        // Add one-time listener to target
        target.once(event, listener);

        // Track the listener
        if (!this.listeners.has(key)) {
            this.listeners.set(key, []);
        }

        this.listeners.get(key).push({
            target,
            event,
            listener,
            once: true
        });

        // Return function to remove listener
        return () => this.removeListener(key, target, event, listener);
    }

    /**
     * Remove a specific event listener
     * @param {string} key - Tracking key
     * @param {EventEmitter} target - Event emitter target
     * @param {string} event - Event name
     * @param {Function} listener - Event listener function
     * @returns {boolean} Whether listener was removed
     */
    removeListener(key, target, event, listener) {
        const listeners = this.listeners.get(key);
        if (!listeners) {
            return false;
        }

        const index = listeners.findIndex(
            l => l.target === target && l.event === event && l.listener === listener
        );

        if (index !== -1) {
            const listenerInfo = listeners[index];
            target.off(event, listener);
            listeners.splice(index, 1);

            // Clean up empty arrays
            if (listeners.length === 0) {
                this.listeners.delete(key);
            }

            return true;
        }

        return false;
    }

    /**
     * Remove all listeners for a specific key
     * @param {string} key - Tracking key
     * @returns {number} Number of listeners removed
     */
    removeAllListeners(key) {
        const listeners = this.listeners.get(key);
        if (!listeners) {
            return 0;
        }

        listeners.forEach(({ target, event, listener }) => {
            target.off(event, listener);
        });

        const count = listeners.length;
        this.listeners.delete(key);

        return count;
    }

    /**
     * Remove all listeners for a specific target and event
     * @param {EventEmitter} target - Event emitter target
     * @param {string} event - Event name
     * @returns {number} Number of listeners removed
     */
    removeAllListenersForEvent(target, event) {
        let count = 0;

        this.listeners.forEach((listeners, key) => {
            const toRemove = listeners.filter(
                l => l.target === target && l.event === event
            );

            toRemove.forEach(({ listener }) => {
                target.off(event, listener);
            });

            // Remove tracked entries
            const remaining = listeners.filter(
                l => !(l.target === target && l.event === event)
            );

            if (remaining.length === 0) {
                this.listeners.delete(key);
            } else {
                this.listeners.set(key, remaining);
            }

            count += toRemove.length;
        });

        return count;
    }

    /**
     * Remove all listeners for a specific target
     * @param {EventEmitter} target - Event emitter target
     * @returns {number} Number of listeners removed
     */
    removeAllListenersForTarget(target) {
        let count = 0;

        this.listeners.forEach((listeners, key) => {
            const toRemove = listeners.filter(l => l.target === target);

            toRemove.forEach(({ event, listener }) => {
                target.off(event, listener);
            });

            // Remove tracked entries
            const remaining = listeners.filter(l => l.target !== target);

            if (remaining.length === 0) {
                this.listeners.delete(key);
            } else {
                this.listeners.set(key, remaining);
            }

            count += toRemove.length;
        });

        return count;
    }

    /**
     * Clear all tracked listeners
     * @returns {number} Number of listeners cleared
     */
    clearAll() {
        let count = 0;

        this.listeners.forEach((listeners) => {
            listeners.forEach(({ target, event, listener }) => {
                target.off(event, listener);
            });
            count += listeners.length;
        });

        this.listeners.clear();

        return count;
    }

    /**
     * Get all listener keys
     * @returns {string[]} Array of listener keys
     */
    getKeys() {
        return Array.from(this.listeners.keys());
    }

    /**
     * Get listeners for a specific key
     * @param {string} key - Tracking key
     * @returns {Array} Array of listener info objects
     */
    getListeners(key) {
        return this.listeners.get(key) || [];
    }

    /**
     * Get count of listeners for a specific key
     * @param {string} key - Tracking key
     * @returns {number} Count of listeners
     */
    getListenerCount(key) {
        const listeners = this.listeners.get(key);
        return listeners ? listeners.length : 0;
    }

    /**
     * Get total count of all tracked listeners
     * @returns {number} Total count of listeners
     */
    getTotalCount() {
        let count = 0;
        this.listeners.forEach((listeners) => {
            count += listeners.length;
        });
        return count;
    }

    /**
     * Get statistics about tracked listeners
     * @returns {Object} Statistics object
     */
    getStats() {
        const stats = {
            totalListeners: 0,
            keys: 0,
            byTarget: new Map(),
            byEvent: new Map()
        };

        this.listeners.forEach((listeners, key) => {
            stats.keys++;
            stats.totalListeners += listeners.length;

            listeners.forEach(({ target, event }) => {
                // Count by target
                const targetKey = target.constructor.name;
                stats.byTarget.set(
                    targetKey,
                    (stats.byTarget.get(targetKey) || 0) + 1
                );

                // Count by event
                stats.byEvent.set(
                    event,
                    (stats.byEvent.get(event) || 0) + 1
                );
            });
        });

        return {
            totalListeners: stats.totalListeners,
            keys: stats.keys,
            byTarget: Object.fromEntries(stats.byTarget),
            byEvent: Object.fromEntries(stats.byEvent)
        };
    }

    /**
     * Check if has listeners for a specific key
     * @param {string} key - Tracking key
     * @returns {boolean} Whether has listeners
     */
    hasListeners(key) {
        return this.listeners.has(key) && this.listeners.get(key).length > 0;
    }

    /**
     * Clear listeners by key pattern
     * @param {RegExp} pattern - Pattern to match keys
     * @returns {number} Number of listeners cleared
     */
    clearByPattern(pattern) {
        let count = 0;

        this.listeners.forEach((listeners, key) => {
            if (pattern.test(key)) {
                listeners.forEach(({ target, event, listener }) => {
                    target.off(event, listener);
                });
                count += listeners.length;
                this.listeners.delete(key);
            }
        });

        return count;
    }
}

// ============================================================================
// GLOBAL EVENT LISTENER MANAGER INSTANCE
// ============================================================================

/**
 * Global event listener manager instance
 * @type {EventListenerManager}
 */
const globalEventListenerManager = new EventListenerManager();

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    EventListenerManager,
    globalEventListenerManager
};
