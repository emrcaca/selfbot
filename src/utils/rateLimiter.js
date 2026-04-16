/**
 * Rate Limiter Module
 *
 * Provides rate limiting functionality using token bucket algorithm
 * to prevent API abuse and ensure compliance with rate limits.
 *
 * @module utils/rateLimiter
 */

// ============================================================================
// TOKEN BUCKET CLASS
// ============================================================================

/**
 * Token Bucket
 *
 * Implements the token bucket algorithm for rate limiting.
 */
class TokenBucket {
    /**
     * @param {number} capacity - Bucket capacity (maximum tokens)
     * @param {number} refillRate - Tokens per second
     */
    constructor(capacity, refillRate) {
        /** @type {number} Bucket capacity */
        this.capacity = capacity;

        /** @type {number} Current token count */
        this.tokens = capacity;

        /** @type {number} Refill rate (tokens per second) */
        this.refillRate = refillRate;

        /** @type {number} Last refill timestamp */
        this.lastRefill = Date.now();
    }

    /**
     * Refill tokens based on elapsed time
     */
    refill() {
        const now = Date.now();
        const elapsed = (now - this.lastRefill) / 1000; // Convert to seconds

        if (elapsed > 0) {
            const tokensToAdd = Math.min(
                this.capacity - this.tokens,
                elapsed * this.refillRate
            );

            this.tokens += tokensToAdd;
            this.lastRefill = now;
        }
    }

    /**
     * Try to consume a token
     * @param {number} count - Number of tokens to consume
     * @returns {boolean} Whether tokens were consumed
     */
    tryConsume(count = 1) {
        this.refill();

        if (this.tokens >= count) {
            this.tokens -= count;
            return true;
        }

        return false;
    }

    /**
     * Get time until next token is available
     * @returns {number} Time in milliseconds
     */
    getTimeUntilNextToken() {
        this.refill();

        if (this.tokens >= 1) {
            return 0;
        }

        const tokensNeeded = 1 - this.tokens;
        const secondsNeeded = tokensNeeded / this.refillRate;

        return Math.ceil(secondsNeeded * 1000);
    }

    /**
     * Get current token count
     * @returns {number} Current token count
     */
    getTokenCount() {
        this.refill();
        return this.tokens;
    }

    /**
     * Reset bucket to full capacity
     */
    reset() {
        this.tokens = this.capacity;
        this.lastRefill = Date.now();
    }
}

// ============================================================================
// RATE LIMITER CLASS
// ============================================================================

/**
 * Rate Limiter
 *
 * Provides rate limiting with:
 * - Token bucket algorithm
 * - Per-key rate limiting
 * - Global rate limiting
 * - Sliding window support
 * - Statistics tracking
 */
class RateLimiter {
    /**
     * @param {Object} options - Rate limiter options
     * @param {number} options.capacity - Bucket capacity
     * @param {number} options.refillRate - Tokens per second
     * @param {number} options.windowSize - Sliding window size in milliseconds
     */
    constructor(options = {}) {
        /** @type {Map<string, TokenBucket>} Per-key buckets */
        this.buckets = new Map();

        /** @type {TokenBucket} Global bucket */
        this.globalBucket = new TokenBucket(
            options.capacity || 10,
            options.refillRate || 1
        );

        /** @type {number} Default bucket capacity */
        this.defaultCapacity = options.capacity || 10;

        /** @type {number} Default refill rate */
        this.defaultRefillRate = options.refillRate || 1;

        /** @type {number} Sliding window size */
        this.windowSize = options.windowSize || 60000;

        /** @type {Map<string, Array<number>>} Request timestamps */
        this.requestTimestamps = new Map();

        /** @type {Object} Rate limiter statistics */
        this.stats = {
            totalRequests: 0,
            allowedRequests: 0,
            deniedRequests: 0,
            perKeyDenied: new Map()
        };
    }

    /**
     * Get or create a bucket for a key
     * @param {string} key - Bucket key
     * @returns {TokenBucket} Token bucket
     */
    getBucket(key) {
        if (!this.buckets.has(key)) {
            this.buckets.set(key, new TokenBucket(
                this.defaultCapacity,
                this.defaultRefillRate
            ));
        }

        return this.buckets.get(key);
    }

    /**
     * Check if request is allowed
     * @param {string} key - Request key (optional)
     * @param {number} count - Number of tokens to consume
     * @returns {boolean} Whether request is allowed
     */
    isAllowed(key = null, count = 1) {
        this.stats.totalRequests++;

        // Check global rate limit
        if (!this.globalBucket.tryConsume(count)) {
            this.stats.deniedRequests++;
            return false;
        }

        // Check per-key rate limit if key provided
        if (key) {
            const bucket = this.getBucket(key);

            if (!bucket.tryConsume(count)) {
                this.stats.deniedRequests++;

                // Track per-key denials
                const deniedCount = this.stats.perKeyDenied.get(key) || 0;
                this.stats.perKeyDenied.set(key, deniedCount + 1);

                return false;
            }
        }

        this.stats.allowedRequests++;
        return true;
    }

    /**
     * Wait until request is allowed
     * @param {string} key - Request key (optional)
     * @param {number} count - Number of tokens to consume
     * @param {number} timeout - Maximum wait time in milliseconds
     * @returns {Promise<boolean>} Whether request was allowed
     */
    async waitForAllowed(key = null, count = 1, timeout = 30000) {
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            if (this.isAllowed(key, count)) {
                return true;
            }

            // Calculate wait time
            const waitTime = Math.min(
                this.globalBucket.getTimeUntilNextToken(),
                key ? this.getBucket(key).getTimeUntilNextToken() : Infinity,
                1000 // Max wait per iteration
            );

            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        return false;
    }

    /**
     * Check sliding window rate limit
     * @param {string} key - Request key
     * @param {number} limit - Maximum requests in window
     * @returns {boolean} Whether request is allowed
     */
    isAllowedSlidingWindow(key, limit) {
        const now = Date.now();
        const windowStart = now - this.windowSize;

        // Get or create timestamp array
        if (!this.requestTimestamps.has(key)) {
            this.requestTimestamps.set(key, []);
        }

        const timestamps = this.requestTimestamps.get(key);

        // Remove timestamps outside window
        const validTimestamps = timestamps.filter(t => t > windowStart);
        this.requestTimestamps.set(key, validTimestamps);

        // Check if under limit
        if (validTimestamps.length < limit) {
            validTimestamps.push(now);
            this.stats.allowedRequests++;
            return true;
        }

        this.stats.deniedRequests++;
        return false;
    }

    /**
     * Get time until next request is allowed
     * @param {string} key - Request key (optional)
     * @returns {number} Time in milliseconds
     */
    getTimeUntilAllowed(key = null) {
        const globalTime = this.globalBucket.getTimeUntilNextToken();

        if (!key) {
            return globalTime;
        }

        const keyTime = this.getBucket(key).getTimeUntilNextToken();

        return Math.max(globalTime, keyTime);
    }

    /**
     * Get remaining tokens
     * @param {string} key - Request key (optional)
     * @returns {number} Remaining tokens
     */
    getRemainingTokens(key = null) {
        if (!key) {
            return this.globalBucket.getTokenCount();
        }

        return this.getBucket(key).getTokenCount();
    }

    /**
     * Reset rate limiter
     * @param {string} key - Request key to reset (optional)
     */
    reset(key = null) {
        if (key) {
            this.buckets.delete(key);
            this.requestTimestamps.delete(key);
        } else {
            this.buckets.clear();
            this.requestTimestamps.clear();
            this.globalBucket.reset();
        }
    }

    /**
     * Get rate limiter statistics
     * @returns {Object} Rate limiter statistics
     */
    getStats() {
        const allowRate = this.stats.totalRequests > 0
            ? (this.stats.allowedRequests / this.stats.totalRequests) * 100
            : 0;

        return {
            totalRequests: this.stats.totalRequests,
            allowedRequests: this.stats.allowedRequests,
            deniedRequests: this.stats.deniedRequests,
            allowRate: allowRate.toFixed(2) + '%',
            globalTokens: this.globalBucket.getTokenCount(),
            globalCapacity: this.globalBucket.capacity,
            perKeyBuckets: this.buckets.size,
            perKeyDenied: Object.fromEntries(this.stats.perKeyDenied)
        };
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            totalRequests: 0,
            allowedRequests: 0,
            deniedRequests: 0,
            perKeyDenied: new Map()
        };
    }

    /**
     * Set bucket capacity
     * @param {number} capacity - New capacity
     */
    setCapacity(capacity) {
        this.defaultCapacity = capacity;
        this.globalBucket.capacity = capacity;
    }

    /**
     * Set refill rate
     * @param {number} rate - New refill rate (tokens per second)
     */
    setRefillRate(rate) {
        this.defaultRefillRate = rate;
        this.globalBucket.refillRate = rate;
    }

    /**
     * Set window size for sliding window
     * @param {number} size - New window size in milliseconds
     */
    setWindowSize(size) {
        this.windowSize = size;
    }

    /**
     * Clean up old buckets
     * @param {number} maxAge - Maximum age in milliseconds
     * @returns {number} Number of buckets cleaned up
     */
    cleanup(maxAge = 3600000) {
        let cleaned = 0;

        this.buckets.forEach((bucket, key) => {
            const age = Date.now() - bucket.lastRefill;
            if (age > maxAge) {
                this.buckets.delete(key);
                cleaned++;
            }
        });

        return cleaned;
    }

    /**
     * Destroy rate limiter and cleanup resources
     */
    destroy() {
        this.buckets.clear();
        this.requestTimestamps.clear();
        this.resetStats();
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    RateLimiter,
    TokenBucket
};
