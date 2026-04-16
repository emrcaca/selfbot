/**
 * Resource Manager Module
 *
 * Central resource management system that coordinates timeout and
 * event listener management to prevent memory leaks.
 *
 * @module utils/managers/resourceManager
 */

const { TimeoutManager } = require('./timeoutManager');
const { EventListenerManager } = require('./eventListenerManager');

// ============================================================================
// RESOURCE MANAGER CLASS
// ============================================================================

/**
 * Resource Manager
 *
 * Central resource management system that coordinates all resource
 * cleanup including timeouts, intervals, and event listeners.
 */
class ResourceManager {
    constructor() {
        /** @type {TimeoutManager} Timeout manager instance */
        this.timeoutManager = new TimeoutManager();

        /** @type {EventListenerManager} Event listener manager instance */
        this.eventListenerManager = new EventListenerManager();

        /** @type {Map<string, Function>} Map of cleanup functions */
        this.cleanupFunctions = new Map();
    }

    /**
     * Get the timeout manager
     * @returns {TimeoutManager} Timeout manager instance
     */
    getTimeoutManager() {
        return this.timeoutManager;
    }

    /**
     * Get the event listener manager
     * @returns {EventListenerManager} Event listener manager instance
     */
    getEventListenerManager() {
        return this.eventListenerManager;
    }

    /**
     * Register a cleanup function
     * @param {string} key - Unique key for the cleanup function
     * @param {Function} cleanup - Cleanup function to execute
     */
    registerCleanup(key, cleanup) {
        this.cleanupFunctions.set(key, cleanup);
    }

    /**
     * Execute and remove a cleanup function
     * @param {string} key - Key of the cleanup function
     * @returns {boolean} Whether cleanup was executed
     */
    executeCleanup(key) {
        const cleanup = this.cleanupFunctions.get(key);
        if (cleanup) {
            try {
                cleanup();
                this.cleanupFunctions.delete(key);
                return true;
            } catch (error) {
                console.error(`Error executing cleanup for ${key}:`, error);
                this.cleanupFunctions.delete(key);
                return false;
            }
        }
        return false;
    }

    /**
     * Clear all resources for a specific key
     * @param {string} key - Key to clear resources for
     * @returns {Object} Object with counts of cleared resources
     */
    clearResources(key) {
        const result = {
            timeouts: 0,
            intervals: 0,
            immediates: 0,
            listeners: 0,
            cleanup: false
        };

        // Clear timeouts
        if (this.timeoutManager.hasTimeout(key)) {
            this.timeoutManager.clearTimeout(key);
            result.timeouts = 1;
        }

        // Clear intervals
        if (this.timeoutManager.hasInterval(key)) {
            this.timeoutManager.clearInterval(key);
            result.intervals = 1;
        }

        // Clear immediates
        if (this.timeoutManager.hasImmediate(key)) {
            this.timeoutManager.clearImmediate(key);
            result.immediates = 1;
        }

        // Clear event listeners
        result.listeners = this.eventListenerManager.removeAllListeners(key);

        // Execute cleanup function
        result.cleanup = this.executeCleanup(key);

        return result;
    }

    /**
     * Clear all resources by key pattern
     * @param {RegExp} pattern - Pattern to match keys
     * @returns {Object} Object with counts of cleared resources
     */
    clearResourcesByPattern(pattern) {
        const result = {
            timeouts: 0,
            intervals: 0,
            immediates: 0,
            listeners: 0,
            cleanup: 0
        };

        // Clear timeouts by pattern
        result.timeouts = this.timeoutManager.clearByPattern(pattern);

        // Clear intervals by pattern
        result.intervals = this.timeoutManager.clearByPattern(pattern);

        // Clear immediates by pattern
        result.immediates = this.timeoutManager.clearByPattern(pattern);

        // Clear event listeners by pattern
        result.listeners = this.eventListenerManager.clearByPattern(pattern);

        // Execute cleanup functions by pattern
        this.cleanupFunctions.forEach((cleanup, key) => {
            if (pattern.test(key)) {
                try {
                    cleanup();
                    this.cleanupFunctions.delete(key);
                    result.cleanup++;
                } catch (error) {
                    console.error(`Error executing cleanup for ${key}:`, error);
                    this.cleanupFunctions.delete(key);
                }
            }
        });

        return result;
    }

    /**
     * Clear all resources
     * @returns {Object} Object with counts of cleared resources
     */
    clearAll() {
        const result = {
            timeouts: this.timeoutManager.getTimeoutCount(),
            intervals: this.timeoutManager.getIntervalCount(),
            immediates: this.timeoutManager.getImmediateCount(),
            listeners: this.eventListenerManager.getTotalCount(),
            cleanup: this.cleanupFunctions.size
        };

        // Clear all timeouts
        this.timeoutManager.clearTimeouts();

        // Clear all intervals
        this.timeoutManager.clearIntervals();

        // Clear all immediates
        this.timeoutManager.clearImmediates();

        // Clear all event listeners
        this.eventListenerManager.clearAll();

        // Execute all cleanup functions
        this.cleanupFunctions.forEach((cleanup, key) => {
            try {
                cleanup();
            } catch (error) {
                console.error(`Error executing cleanup for ${key}:`, error);
            }
        });
        this.cleanupFunctions.clear();

        return result;
    }

    /**
     * Get comprehensive statistics about all resources
     * @returns {Object} Statistics object
     */
    getStats() {
        const timeoutStats = this.timeoutManager.getStats();
        const listenerStats = this.eventListenerManager.getStats();

        return {
            timeouts: timeoutStats.timeouts,
            intervals: timeoutStats.intervals,
            immediates: timeoutStats.immediates,
            totalTimedOperations: timeoutStats.total,
            listeners: listenerStats.totalListeners,
            listenerKeys: listenerStats.keys,
            listenersByTarget: listenerStats.byTarget,
            listenersByEvent: listenerStats.byEvent,
            cleanupFunctions: this.cleanupFunctions.size,
            totalResources: timeoutStats.total + listenerStats.totalListeners + this.cleanupFunctions.size
        };
    }

    /**
     * Check if has any resources for a specific key
     * @param {string} key - Key to check
     * @returns {boolean} Whether has resources
     */
    hasResources(key) {
        return this.timeoutManager.hasTimeout(key) ||
               this.timeoutManager.hasInterval(key) ||
               this.timeoutManager.hasImmediate(key) ||
               this.eventListenerManager.hasListeners(key) ||
               this.cleanupFunctions.has(key);
    }

    /**
     * Get all resource keys
     * @returns {string[]} Array of resource keys
     */
    getResourceKeys() {
        const keys = new Set([
            ...this.timeoutManager.getTimeoutKeys(),
            ...this.timeoutManager.getIntervalKeys(),
            ...this.timeoutManager.getImmediateKeys(),
            ...this.eventListenerManager.getKeys(),
            ...this.cleanupFunctions.keys()
        ]);
        return Array.from(keys);
    }

    /**
     * Create a scoped resource manager
     * @param {string} scope - Scope name for the manager
     * @returns {ScopedResourceManager} Scoped resource manager
     */
    createScope(scope) {
        return new ScopedResourceManager(this, scope);
    }
}

// ============================================================================
// SCOPED RESOURCE MANAGER CLASS
// ============================================================================

/**
 * Scoped Resource Manager
 *
 * A resource manager scoped to a specific context, automatically
 * prefixing all keys with the scope name.
 */
class ScopedResourceManager {
    /**
     * @param {ResourceManager} parent - Parent resource manager
     * @param {string} scope - Scope name
     */
    constructor(parent, scope) {
        this.parent = parent;
        this.scope = scope;
    }

    /**
     * Prefix a key with the scope
     * @param {string} key - Key to prefix
     * @returns {string} Prefixed key
     */
    prefixKey(key) {
        return `${this.scope}:${key}`;
    }

    /**
     * Set a timeout
     * @param {string} key - Key for the timeout
     * @param {Function} callback - Callback function
     * @param {number} delay - Delay in milliseconds
     * @returns {NodeJS.Timeout} The timeout object
     */
    setTimeout(key, callback, delay) {
        return this.parent.timeoutManager.setTimeout(
            this.prefixKey(key),
            callback,
            delay
        );
    }

    /**
     * Clear a timeout
     * @param {string} key - Key of the timeout
     * @returns {boolean} Whether timeout was cleared
     */
    clearTimeout(key) {
        return this.parent.timeoutManager.clearTimeout(this.prefixKey(key));
    }

    /**
     * Set an interval
     * @param {string} key - Key for the interval
     * @param {Function} callback - Callback function
     * @param {number} delay - Delay in milliseconds
     * @returns {NodeJS.Timeout} The interval object
     */
    setInterval(key, callback, delay) {
        return this.parent.timeoutManager.setInterval(
            this.prefixKey(key),
            callback,
            delay
        );
    }

    /**
     * Clear an interval
     * @param {string} key - Key of the interval
     * @returns {boolean} Whether interval was cleared
     */
    clearInterval(key) {
        return this.parent.timeoutManager.clearInterval(this.prefixKey(key));
    }

    /**
     * Add an event listener
     * @param {EventEmitter} target - Event emitter target
     * @param {string} event - Event name
     * @param {Function} listener - Event listener function
     * @param {string} key - Key for tracking
     * @returns {Function} Function to remove the listener
     */
    addListener(target, event, listener, key) {
        return this.parent.eventListenerManager.addListener(
            target,
            event,
            listener,
            this.prefixKey(key)
        );
    }

    /**
     * Remove all listeners for this scope
     * @returns {number} Number of listeners removed
     */
    removeAllListeners() {
        let count = 0;
        const pattern = new RegExp(`^${this.escapeRegExp(this.scope)}:`);

        count += this.parent.timeoutManager.clearByPattern(pattern);
        count += this.parent.eventListenerManager.clearByPattern(pattern);

        this.parent.cleanupFunctions.forEach((cleanup, key) => {
            if (pattern.test(key)) {
                try {
                    cleanup();
                } catch (error) {
                    console.error(`Error executing cleanup for ${key}:`, error);
                }
                this.parent.cleanupFunctions.delete(key);
                count++;
            }
        });

        return count;
    }

    /**
     * Escape special regex characters
     * @param {string} string - String to escape
     * @returns {string} Escaped string
     */
    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}

// ============================================================================
// GLOBAL RESOURCE MANAGER INSTANCE
// ============================================================================

/**
 * Global resource manager instance
 * @type {ResourceManager}
 */
const globalResourceManager = new ResourceManager();

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    ResourceManager,
    ScopedResourceManager,
    globalResourceManager
};
