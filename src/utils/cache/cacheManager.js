/**
 * Cache Manager Module
 *
 * Provides a flexible caching system with TTL support and
 * multiple cache strategies.
 *
 * @module utils/cache/cacheManager
 */

// ============================================================================
// CACHE ENTRY CLASS
// ============================================================================

/**
 * Cache Entry
 *
 * Represents a single cache entry with value and metadata.
 */
class CacheEntry {
    /**
     * @param {*} value - The cached value
     * @param {number} ttl - Time to live in milliseconds
     */
    constructor(value, ttl) {
        this.value = value;
        this.createdAt = Date.now();
        this.ttl = ttl;
        this.hits = 0;
        this.lastAccessedAt = Date.now();
    }

    /**
     * Check if entry is expired
     * @returns {boolean} Whether entry is expired
     */
    isExpired() {
        if (this.ttl === null || this.ttl === undefined) {
            return false;
        }
        return Date.now() - this.createdAt > this.ttl;
    }

    /**
     * Get the cached value
     * @returns {*} The cached value
     */
    get() {
        this.hits++;
        this.lastAccessedAt = Date.now();
        return this.value;
    }

    /**
     * Get entry age in milliseconds
     * @returns {number} Entry age
     */
    getAge() {
        return Date.now() - this.createdAt;
    }

    /**
     * Get time since last access in milliseconds
     * @returns {number} Time since last access
     */
    getTimeSinceLastAccess() {
        return Date.now() - this.lastAccessedAt;
    }
}

// ============================================================================
// CACHE MANAGER CLASS
// ============================================================================

/**
 * Cache Manager
 *
 * Provides a flexible caching system with:
 * - TTL (Time To Live) support
 * - Maximum size limit
 * - Multiple eviction strategies
 * - Statistics tracking
 */
class CacheManager {
    /**
     * @param {Object} options - Cache options
     * @param {number} options.defaultTtl - Default TTL in milliseconds
     * @param {number} options.maxSize - Maximum cache size
     * @param {string} options.evictionStrategy - Eviction strategy ('lru', 'lfu', 'fifo')
     */
    constructor(options = {}) {
        /** @type {Map<string, CacheEntry>} Cache storage */
        this.cache = new Map();

        /** @type {number} Default TTL in milliseconds */
        this.defaultTtl = options.defaultTtl || null;

        /** @type {number} Maximum cache size */
        this.maxSize = options.maxSize || 1000;

        /** @type {string} Eviction strategy */
        this.evictionStrategy = options.evictionStrategy || 'lru';

        /** @type {Object} Cache statistics */
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            evictions: 0
        };

        /** @type {NodeJS.Timeout|null} Cleanup interval */
        this.cleanupInterval = null;

        /** @type {number} Cleanup interval in milliseconds */
        this.cleanupIntervalMs = options.cleanupIntervalMs || 60000;

        // Start cleanup interval
        this.startCleanup();
    }

    /**
     * Set a value in the cache
     * @param {string} key - Cache key
     * @param {*} value - Value to cache
     * @param {number} ttl - Time to live in milliseconds (optional)
     * @returns {boolean} Whether value was set
     */
    set(key, value, ttl = this.defaultTtl) {
        if (!key || typeof key !== 'string') {
            return false;
        }

        // Check if we need to evict
        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            this.evict();
        }

        const entry = new CacheEntry(value, ttl);
        this.cache.set(key, entry);
        this.stats.sets++;

        return true;
    }

    /**
     * Get a value from the cache
     * @param {string} key - Cache key
     * @returns {*} Cached value or null if not found/expired
     */
    get(key) {
        const entry = this.cache.get(key);

        if (!entry) {
            this.stats.misses++;
            return null;
        }

        if (entry.isExpired()) {
            this.delete(key);
            this.stats.misses++;
            return null;
        }

        this.stats.hits++;
        return entry.get();
    }

    /**
     * Check if key exists in cache
     * @param {string} key - Cache key
     * @returns {boolean} Whether key exists and is not expired
     */
    has(key) {
        const entry = this.cache.get(key);

        if (!entry) {
            return false;
        }

        if (entry.isExpired()) {
            this.delete(key);
            return false;
        }

        return true;
    }

    /**
     * Delete a value from the cache
     * @param {string} key - Cache key
     * @returns {boolean} Whether value was deleted
     */
    delete(key) {
        const deleted = this.cache.delete(key);
        if (deleted) {
            this.stats.deletes++;
        }
        return deleted;
    }

    /**
     * Clear all values from the cache
     */
    clear() {
        this.cache.clear();
    }

    /**
     * Get cache size
     * @returns {number} Cache size
     */
    size() {
        return this.cache.size;
    }

    /**
     * Get all cache keys
     * @returns {string[]} Array of cache keys
     */
    keys() {
        return Array.from(this.cache.keys());
    }

    /**
     * Get all cache values
     * @returns {Array} Array of cache values
     */
    values() {
        return Array.from(this.cache.values()).map(entry => entry.get());
    }

    /**
     * Get all cache entries
     * @returns {Array} Array of cache entries
     */
    entries() {
        return Array.from(this.cache.entries()).map(([key, entry]) => [key, entry.get()]);
    }

    /**
     * Evict a cache entry based on strategy
     */
    evict() {
        if (this.cache.size === 0) {
            return;
        }

        let keyToEvict;

        switch (this.evictionStrategy) {
            case 'lru':
                // Least Recently Used
                keyToEvict = this.findLRUKey();
                break;

            case 'lfu':
                // Least Frequently Used
                keyToEvict = this.findLFUKey();
                break;

            case 'fifo':
                // First In First Out
                keyToEvict = this.findFIFOKey();
                break;

            default:
                keyToEvict = this.findLRUKey();
        }

        if (keyToEvict) {
            this.delete(keyToEvict);
            this.stats.evictions++;
        }
    }

    /**
     * Find least recently used key
     * @returns {string|null} LRU key or null
     */
    findLRUKey() {
        let lruKey = null;
        let lruTime = Infinity;

        this.cache.forEach((entry, key) => {
            if (entry.lastAccessedAt < lruTime) {
                lruTime = entry.lastAccessedAt;
                lruKey = key;
            }
        });

        return lruKey;
    }

    /**
     * Find least frequently used key
     * @returns {string|null} LFU key or null
     */
    findLFUKey() {
        let lfuKey = null;
        let lfuHits = Infinity;

        this.cache.forEach((entry, key) => {
            if (entry.hits < lfuHits) {
                lfuHits = entry.hits;
                lfuKey = key;
            }
        });

        return lfuKey;
    }

    /**
     * Find first in first out key
     * @returns {string|null} FIFO key or null
     */
    findFIFOKey() {
        let fifoKey = null;
        let fifoTime = Infinity;

        this.cache.forEach((entry, key) => {
            if (entry.createdAt < fifoTime) {
                fifoTime = entry.createdAt;
                fifoKey = key;
            }
        });

        return fifoKey;
    }

    /**
     * Clean up expired entries
     * @returns {number} Number of entries cleaned up
     */
    cleanup() {
        let cleaned = 0;

        this.cache.forEach((entry, key) => {
            if (entry.isExpired()) {
                this.delete(key);
                cleaned++;
            }
        });

        return cleaned;
    }

    /**
     * Start automatic cleanup interval
     */
    startCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }

        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, this.cleanupIntervalMs);
    }

    /**
     * Stop automatic cleanup interval
     */
    stopCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    getStats() {
        const hitRate = this.stats.hits + this.stats.misses > 0
            ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100
            : 0;

        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            hits: this.stats.hits,
            misses: this.stats.misses,
            hitRate: hitRate.toFixed(2) + '%',
            sets: this.stats.sets,
            deletes: this.stats.deletes,
            evictions: this.stats.evictions,
            evictionStrategy: this.evictionStrategy
        };
    }

    /**
     * Reset cache statistics
     */
    resetStats() {
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            evictions: 0
        };
    }

    /**
     * Get or set value (get if exists, set if not)
     * @param {string} key - Cache key
     * @param {Function} factory - Function to create value if not in cache
     * @param {number} ttl - Time to live in milliseconds (optional)
     * @returns {*} Cached or newly created value
     */
    async getOrSet(key, factory, ttl = this.defaultTtl) {
        const cached = this.get(key);

        if (cached !== null) {
            return cached;
        }

        const value = await factory();
        this.set(key, value, ttl);

        return value;
    }

    /**
     * Get multiple values from cache
     * @param {string[]} keys - Array of cache keys
     * @returns {Object} Object with key-value pairs
     */
    getMany(keys) {
        const result = {};

        keys.forEach(key => {
            result[key] = this.get(key);
        });

        return result;
    }

    /**
     * Set multiple values in cache
     * @param {Object} entries - Object with key-value pairs
     * @param {number} ttl - Time to live in milliseconds (optional)
     */
    setMany(entries, ttl = this.defaultTtl) {
        Object.entries(entries).forEach(([key, value]) => {
            this.set(key, value, ttl);
        });
    }

    /**
     * Delete multiple values from cache
     * @param {string[]} keys - Array of cache keys
     * @returns {number} Number of values deleted
     */
    deleteMany(keys) {
        let deleted = 0;

        keys.forEach(key => {
            if (this.delete(key)) {
                deleted++;
            }
        });

        return deleted;
    }

    /**
     * Destroy cache manager and cleanup resources
     */
    destroy() {
        this.stopCleanup();
        this.clear();
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    CacheManager,
    CacheEntry
};
