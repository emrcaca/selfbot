/**
 * Async Queue Module
 *
 * Provides an async queue system for managing concurrent operations
 * with configurable concurrency limits and timeout support.
 *
 * @module utils/asyncQueue
 */

// ============================================================================
// QUEUE ITEM CLASS
// ============================================================================

/**
 * Queue Item
 *
 * Represents a single item in the async queue.
 */
class QueueItem {
    /**
     * @param {Function} task - Task function to execute
     * @param {Function} resolve - Resolve function for the promise
     * @param {Function} reject - Reject function for the promise
     * @param {number} timestamp - Timestamp when item was added
     */
    constructor(task, resolve, reject, timestamp) {
        this.task = task;
        this.resolve = resolve;
        this.reject = reject;
        this.timestamp = timestamp;
        this.startedAt = null;
        this.completedAt = null;
    }

    /**
     * Mark item as started
     */
    start() {
        this.startedAt = Date.now();
    }

    /**
     * Mark item as completed
     */
    complete() {
        this.completedAt = Date.now();
    }

    /**
     * Get wait time in milliseconds
     * @returns {number} Wait time
     */
    getWaitTime() {
        if (!this.startedAt) {
            return Date.now() - this.timestamp;
        }
        return this.startedAt - this.timestamp;
    }

    /**
     * Get execution time in milliseconds
     * @returns {number} Execution time or null if not completed
     */
    getExecutionTime() {
        if (!this.completedAt || !this.startedAt) {
            return null;
        }
        return this.completedAt - this.startedAt;
    }
}

// ============================================================================
// ASYNC QUEUE CLASS
// ============================================================================

/**
 * Async Queue
 *
 * Provides an async queue system with:
 * - Configurable concurrency limits
 * - Timeout support
 * - Queue size limits
 * - Statistics tracking
 * - Priority support
 */
class AsyncQueue {
    /**
     * @param {Object} options - Queue options
     * @param {number} options.concurrency - Maximum concurrent operations
     * @param {number} options.maxSize - Maximum queue size
     * @param {number} options.timeout - Default timeout in milliseconds
     * @param {boolean} options.timeoutEnabled - Whether timeout is enabled
     */
    constructor(options = {}) {
        /** @type {Array<QueueItem>} Queue items */
        this.queue = [];

        /** @type {number} Number of running operations */
        this.running = 0;

        /** @type {number} Maximum concurrent operations */
        this.concurrency = options.concurrency || 5;

        /** @type {number} Maximum queue size */
        this.maxSize = options.maxSize || 100;

        /** @type {number} Default timeout in milliseconds */
        this.timeout = options.timeout || 30000;

        /** @type {boolean} Whether timeout is enabled */
        this.timeoutEnabled = options.timeoutEnabled !== false;

        /** @type {Object} Queue statistics */
        this.stats = {
            added: 0,
            completed: 0,
            failed: 0,
            timedOut: 0,
            rejected: 0
        };

        /** @type {boolean} Whether queue is paused */
        this.paused = false;
    }

    /**
     * Add a task to the queue
     * @param {Function} task - Task function to execute
     * @param {Object} options - Task options
     * @param {number} options.timeout - Timeout in milliseconds
     * @param {number} options.priority - Priority (higher = more important)
     * @returns {Promise} Promise that resolves when task completes
     */
    add(task, options = {}) {
        return new Promise((resolve, reject) => {
            // Check queue size limit
            if (this.queue.length >= this.maxSize) {
                this.stats.rejected++;
                reject(new Error('Queue is full'));
                return;
            }

            const item = new QueueItem(
                task,
                resolve,
                reject,
                Date.now()
            );

            // Handle priority
            const priority = options.priority || 0;
            if (priority > 0) {
                // Insert at appropriate position based on priority
                let insertIndex = this.queue.length;
                for (let i = 0; i < this.queue.length; i++) {
                    if (priority > (this.queue[i].priority || 0)) {
                        insertIndex = i;
                        break;
                    }
                }
                this.queue.splice(insertIndex, 0, item);
            } else {
                this.queue.push(item);
            }

            this.stats.added++;

            // Process queue
            this.process();
        });
    }

    /**
     * Process the queue
     */
    async process() {
        // Don't process if paused
        if (this.paused) {
            return;
        }

        // Process while we have capacity and items
        while (this.running < this.concurrency && this.queue.length > 0) {
            this.running++;

            const item = this.queue.shift();
            item.start();

            // Execute task with timeout if enabled
            if (this.timeoutEnabled) {
                this.executeWithTimeout(item);
            } else {
                this.executeWithoutTimeout(item);
            }
        }
    }

    /**
     * Execute task with timeout
     * @param {QueueItem} item - Queue item
     */
    async executeWithTimeout(item) {
        let timeoutId;

        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
                this.stats.timedOut++;
                this.running--;
                reject(new Error('Task timed out'));
                this.process();
            }, this.timeout);
        });

        try {
            const result = await Promise.race([
                item.task(),
                timeoutPromise
            ]);

            clearTimeout(timeoutId);
            item.complete();
            this.stats.completed++;
            item.resolve(result);
        } catch (error) {
            clearTimeout(timeoutId);
            item.complete();
            this.stats.failed++;
            item.reject(error);
        } finally {
            this.running--;
            this.process();
        }
    }

    /**
     * Execute task without timeout
     * @param {QueueItem} item - Queue item
     */
    async executeWithoutTimeout(item) {
        try {
            const result = await item.task();
            item.complete();
            this.stats.completed++;
            item.resolve(result);
        } catch (error) {
            item.complete();
            this.stats.failed++;
            item.reject(error);
        } finally {
            this.running--;
            this.process();
        }
    }

    /**
     * Pause the queue
     */
    pause() {
        this.paused = true;
    }

    /**
     * Resume the queue
     */
    resume() {
        this.paused = false;
        this.process();
    }

    /**
     * Clear the queue
     * @returns {number} Number of items cleared
     */
    clear() {
        const count = this.queue.length;

        // Reject all pending items
        this.queue.forEach(item => {
            this.stats.rejected++;
            item.reject(new Error('Queue cleared'));
        });

        this.queue = [];

        return count;
    }

    /**
     * Get queue size
     * @returns {number} Queue size
     */
    size() {
        return this.queue.length;
    }

    /**
     * Get number of running operations
     * @returns {number} Number of running operations
     */
    getRunningCount() {
        return this.running;
    }

    /**
     * Check if queue is empty
     * @returns {boolean} Whether queue is empty
     */
    isEmpty() {
        return this.queue.length === 0 && this.running === 0;
    }

    /**
     * Check if queue is full
     * @returns {boolean} Whether queue is full
     */
    isFull() {
        return this.queue.length >= this.maxSize;
    }

    /**
     * Get queue statistics
     * @returns {Object} Queue statistics
     */
    getStats() {
        const successRate = this.stats.completed + this.stats.failed > 0
            ? (this.stats.completed / (this.stats.completed + this.stats.failed)) * 100
            : 0;

        return {
            queueSize: this.queue.length,
            running: this.running,
            concurrency: this.concurrency,
            maxSize: this.maxSize,
            timeout: this.timeout,
            timeoutEnabled: this.timeoutEnabled,
            paused: this.paused,
            added: this.stats.added,
            completed: this.stats.completed,
            failed: this.stats.failed,
            timedOut: this.stats.timedOut,
            rejected: this.stats.rejected,
            successRate: successRate.toFixed(2) + '%'
        };
    }

    /**
     * Reset queue statistics
     */
    resetStats() {
        this.stats = {
            added: 0,
            completed: 0,
            failed: 0,
            timedOut: 0,
            rejected: 0
        };
    }

    /**
     * Set concurrency limit
     * @param {number} concurrency - New concurrency limit
     */
    setConcurrency(concurrency) {
        this.concurrency = concurrency;
        this.process();
    }

    /**
     * Set queue size limit
     * @param {number} maxSize - New queue size limit
     */
    setMaxSize(maxSize) {
        this.maxSize = maxSize;
    }

    /**
     * Set timeout
     * @param {number} timeout - New timeout in milliseconds
     */
    setTimeout(timeout) {
        this.timeout = timeout;
    }

    /**
     * Enable or disable timeout
     * @param {boolean} enabled - Whether timeout should be enabled
     */
    setTimeoutEnabled(enabled) {
        this.timeoutEnabled = enabled;
    }

    /**
     * Wait for queue to be empty
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise<boolean>} Whether queue became empty
     */
    async waitForEmpty(timeout = 60000) {
        const startTime = Date.now();

        while (!this.isEmpty()) {
            if (Date.now() - startTime > timeout) {
                return false;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        return true;
    }

    /**
     * Destroy queue and cleanup resources
     */
    destroy() {
        this.clear();
        this.paused = true;
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    AsyncQueue,
    QueueItem
};
