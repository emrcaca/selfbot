/**
 * Helper Utilities
 * Common utility functions used across the application.
 */

const { conditionalLog } = require('./logger');

/**
 * Creates a promise that resolves after a specified delay.
 * @param {number} ms - The delay in milliseconds.
 * @returns {Promise<void>}
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Generates a random integer between min and max (inclusive).
 * @param {number} min - The minimum value.
 * @param {number} max - The maximum value.
 * @returns {number} The random integer.
 */
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

module.exports = {
    delay,
    getRandomInt,
    conditionalLog
};
