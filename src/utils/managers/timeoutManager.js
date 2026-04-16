/**
 * Timeout Manager Module
 *
 * Manages timeout and interval tracking to prevent memory leaks
 * and ensure proper cleanup of scheduled operations.
 *
 * @module utils/managers/timeoutManager
 */

// ============================================================================
// TIMEOUT MANAGER CLASS
// ============================================================================

/**
 * Timeout Manager
 *
 * Tracks and manages all timeouts and intervals to prevent memory leaks
 * and ensure proper cleanup.
 */
class TimeoutManager {
    constructor() {
        /** @type {Map<string, NodeJS.Timeout>} Map of active timeouts */
        this.timeouts = new Map();

        /** @type {Map<string, NodeJS.Timeout>} Map of active intervals */
        this.intervals = new Map();

        /** @type {Map<string, NodeJS.Immediate>} Map of active immediates */
        this.immediates = new Map();
    }

    /**
     * Set a timeout with a key for tracking
     * @param {string} key - Unique key for the timeout
     * @param {Function} callback - Callback function to execute
     * @param {number} delay - Delay in milliseconds
     * @returns {NodeJS.Timeout} The timeout object
     */
    setTimeout(key, callback, delay) {
        // Clear existing timeout with same key
        this.clearTimeout(key);

        const timeout = setTimeout(() => {
            this.timeouts.delete(key);
            callback();
        }, delay);

        this.timeouts.set(key, timeout);
        return timeout;
    }

    /**
     * Clear a timeout by key
     * @param {string} key - Key of the timeout to clear
     * @returns {boolean} Whether timeout was cleared
     */
    clearTimeout(key) {
        const timeout = this.timeouts.get(key);
        if (timeout) {
            clearTimeout(timeout);
            this.timeouts.delete(key);
            return true;
        }
        return false;
    }

    /**
     * Check if a timeout exists
     * @param {string} key - Key to check
     * @returns {boolean} Whether timeout exists
     */
    hasTimeout(key) {
        return this.timeouts.has(key);
    }

    /**
     * Get all timeout keys
     * @returns {string[]} Array of timeout keys
     */
    getTimeoutKeys() {
        return Array.from(this.timeouts.keys());
    }

    /**
     * Get count of active timeouts
     * @returns {number} Count of active timeouts
     */
    getTimeoutCount() {
        return this.timeouts.size;
    }

    /**
     * Set an interval with a key for tracking
     * @param {string} key - Unique key for the interval
     * @param {Function} callback - Callback function to execute
     * @param {number} delay - Delay in milliseconds
     * @returns {NodeJS.Timeout} The interval object
     */
    setInterval(key, callback, delay) {
        // Clear existing interval with same key
        this.clearInterval(key);

        const interval = setInterval(callback, delay);
        this.intervals.set(key, interval);
        return interval;
    }

    /**
     * Clear an interval by key
     * @param {string} key - Key of the interval to clear
     * @returns {boolean} Whether interval was cleared
     */
    clearInterval(key) {
        const interval = this.intervals.get(key);
        if (interval) {
            clearInterval(interval);
            this.intervals.delete(key);
            return true;
        }
        return false;
    }

    /**
     * Check if an interval exists
     * @param {string} key - Key to check
     * @returns {boolean} Whether interval exists
     */
    hasInterval(key) {
        return this.intervals.has(key);
    }

    /**
     * Get all interval keys
     * @returns {string[]} Array of interval keys
     */
    getIntervalKeys() {
        return Array.from(this.intervals.keys());
    }

    /**
     * Get count of active intervals
     * @returns {number} Count of active intervals
     */
    getIntervalCount() {
        return this.intervals.size;
    }

    /**
     * Set an immediate with a key for tracking
     * @param {string} key - Unique key for the immediate
     * @param {Function} callback - Callback function to execute
     * @returns {NodeJS.Immediate} The immediate object
     */
    setImmediate(key, callback) {
        // Clear existing immediate with same key
        this.clearImmediate(key);

        const immediate = setImmediate(() => {
            this.immediates.delete(key);
            callback();
        });

        this.immediates.set(key, immediate);
        return immediate;
    }

    /**
     * Clear an immediate by key
     * @param {string} key - Key of the immediate to clear
     * @returns {boolean} Whether immediate was cleared
     */
    clearImmediate(key) {
        const immediate = this.immediates.get(key);
        if (immediate) {
            clearImmediate(immediate);
            this.immediates.delete(key);
            return true;
        }
        return false;
    }

    /**
     * Check if an immediate exists
     * @param {string} key - Key to check
     * @returns {boolean} Whether immediate exists
     */
    hasImmediate(key) {
        return this.immediates.has(key);
    }

    /**
     * Get all immediate keys
     * @returns {string[]} Array of immediate keys
     */
    getImmediateKeys() {
        return Array.from(this.immediates.keys());
    }

    /**
     * Get count of active immediates
     * @returns {number} Count of active immediates
     */
    getImmediateCount() {
        return this.immediates.size;
    }

    /**
     * Clear all timeouts
     */
    clearTimeouts() {
        this.timeouts.forEach(timeout => clearTimeout(timeout));
        this.timeouts.clear();
    }

    /**
     * Clear all intervals
     */
    clearIntervals() {
        this.intervals.forEach(interval => clearInterval(interval));
        this.intervals.clear();
    }

    /**
     * Clear all immediates
     */
    clearImmediates() {
        this.immediates.forEach(immediate => clearImmediate(immediate));
        this.immediates.clear();
    }

    /**
     * Clear all tracked operations (timeouts, intervals, immediates)
     */
    clearAll() {
        this.clearTimeouts();
        this.clearIntervals();
        this.clearImmediates();
    }

    /**
     * Get statistics about tracked operations
     * @returns {Object} Statistics object
     */
    getStats() {
        return {
            timeouts: this.getTimeoutCount(),
            intervals: this.getIntervalCount(),
            immediates: this.getImmediateCount(),
            total: this.getTimeoutCount() + this.getIntervalCount() + this.getImmediateCount()
        };
    }

    /**
     * Clear operations by key pattern
     * @param {RegExp} pattern - Pattern to match keys
     * @returns {number} Number of operations cleared
     */
    clearByPattern(pattern) {
        let count = 0;

        // Clear matching timeouts
        this.timeouts.forEach((timeout, key) => {
            if (pattern.test(key)) {
                clearTimeout(timeout);
                this.timeouts.delete(key);
                count++;
            }
        });

        // Clear matching intervals
        this.intervals.forEach((interval, key) => {
            if (pattern.test(key)) {
                clearInterval(interval);
                this.intervals.delete(key);
                count++;
            }
        });

        // Clear matching immediates
        this.immediates.forEach((immediate, key) => {
            if (pattern.test(key)) {
                clearImmediate(immediate);
                this.immediates.delete(key);
                count++;
            }
        });

        return count;
    }
}

// ============================================================================
// GLOBAL TIMEOUT MANAGER INSTANCE
// ============================================================================

/**
 * Global timeout manager instance
 * @type {TimeoutManager}
 */
const globalTimeoutManager = new TimeoutManager();

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    TimeoutManager,
    globalTimeoutManager
};
