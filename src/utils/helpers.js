/**
 * Helper Utilities
 *
 * Collection of utility functions used throughout the application
 * including delays and random number generation.
 *
 * @module utils/helpers
 */

// ============================================================================
// DELAY FUNCTIONS
// ============================================================================

/**
 * Create a delay promise
 *
 * Returns a promise that resolves after the specified number of milliseconds.
 *
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>} Promise that resolves after delay
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// RANDOM NUMBER FUNCTIONS
// ============================================================================

/**
 * Generate a random integer between min and max (inclusive)
 *
 * @param {number} min - Minimum value
 * @returns {number} Random integer in range [min, max]
 * @throws {Error} If min > max
 */
function getRandomInt(min, max) {
    if (min > max) {
        throw new Error('min must be less than or equal to max');
    }
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    delay,
    getRandomInt
};
