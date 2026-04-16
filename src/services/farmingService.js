/**
 * Farming Service Module
 *
 * Handles all farming operations including OWO/WHWB farming,
 * channel management, and sleep mode.
 *
 * @module services/farmingService
 */

const { stateManager } = require('../core/state');
const { sendTyping, sendMessage } = require('./discordService');
const { getRandomInt, delay } = require('../utils/helpers');
const { Loggers } = require('../utils/logger');
const { FARMING, PROBABILITY } = require('../config/constants');

// ============================================================================
// FARMING SERVICE CLASS
// ============================================================================

/**
 * Farming Service
 *
 * Manages all farming operations including:
 * - OWO/WHWB command execution
 * - Channel management and cycling
 * - Sleep mode handling
 * - Farming statistics
 */
class FarmingService {
    constructor() {
        /** @type {Object} Service configuration */
        this.config = {
            typingDelay: FARMING.TYPING_DELAY,
            messageDelay: FARMING.MESSAGE_DELAY,
            owoDelay: FARMING.OWO_DELAY,
            whwbDelay: FARMING.WHWB_DELAY,
            sleepDuration: FARMING.SLEEP_DURATION,
            channelCycleDelay: FARMING.CHANNEL_CYCLE_DELAY,
            loopIterationDelay: FARMING.LOOP_ITERATION_DELAY,
            errorRecoveryDelay: FARMING.ERROR_RECOVERY_DELAY,
            criticalErrorDelay: FARMING.CRITICAL_ERROR_DELAY
        };
    }

    /**
     * Get the current channel ID for farming
     * @returns {string|null} Channel ID or null if none available
     */
    getCurrentChannelId() {
        return stateManager.farming.getCurrentChannelId();
    }

    /**
     * Advance to the next channel in rotation
     * @returns {Object|null} Channel change info or null
     */
    advanceToNextChannel() {
        const result = stateManager.farming.advanceToNextChannel();
        if (result) {
            Loggers.Farm.info(`Channel advanced. Old: ${result.oldChannelId}, New: ${result.newChannelId}`);
        }
        return result;
    }

    /**
     * Check if should cycle channels
     * @returns {boolean} Whether channels should be cycled
     */
    shouldCycleChannels() {
        return stateManager.farming.shouldCycleChannels();
    }

    /**
     * Perform random sleep
     * @returns {Promise<void>}
     */
    async performRandomSleep() {
        if (!stateManager.shouldRunLoop('any')) {
            return;
        }

        // Only sleep based on probability
        if (Math.random() >= PROBABILITY.SLEEP) {
            return;
        }

        stateManager.farming.setSleeping(true);

        const sleepDuration = getRandomInt(
            this.config.sleepDuration.MIN,
            this.config.sleepDuration.MAX
        );
        const sleepDurationSeconds = Math.round(sleepDuration / 1000);

        Loggers.Farm.info(`Bot entering sleep mode for ${sleepDurationSeconds}s`);

        try {
            await delay(sleepDuration);
        } finally {
            stateManager.farming.setSleeping(false);
            Loggers.Farm.info('Bot woke up from sleep');
        }
    }

    /**
     * Send OWO command
     * @param {Object} client - Discord client instance
     * @param {string} channelId - Channel ID
     * @returns {Promise<boolean>} Whether command was sent successfully
     */
    async sendOwoCommand(client, channelId) {
        try {
            // Send typing indicator (randomly based on probability)
            await sendTyping(client, channelId);

            // Send OWO command
            const result = await sendMessage(client, channelId, 'Owo');
            Loggers.Farm.info(`OWO command sent to channel: ${channelId}`);

            return result !== null;
        } catch (error) {
            Loggers.Farm.error(`Error sending OWO command: ${error.message}`);
            return false;
        }
    }

    /**
     * Send WH command
     * @param {Object} client - Discord client instance
     * @param {string} channelId - Channel ID
     * @returns {Promise<boolean>} Whether command was sent successfully
     */
    async sendWhCommand(client, channelId) {
        try {
            // Send typing indicator
            await sendTyping(client, channelId);

            // Send WH command
            const result = await sendMessage(client, channelId, 'Owo h');
            return result !== null;
        } catch (error) {
            Loggers.Farm.error(`Error sending WH command: ${error.message}`);
            return false;
        }
    }

    /**
     * Send WB command
     * @param {Object} client - Discord client instance
     * @param {string} channelId - Channel ID
     * @returns {Promise<boolean>} Whether command was sent successfully
     */
    async sendWbCommand(client, channelId) {
        try {
            // Send typing indicator
            await sendTyping(client, channelId);

            // Send WB command
            const result = await sendMessage(client, channelId, 'Owo b');
            return result !== null;
        } catch (error) {
            Loggers.Farm.error(`Error sending WB command: ${error.message}`);
            return false;
        }
    }

    /**
     * Send WH and WB commands in sequence
     * @param {Object} client - Discord client instance
     * @param {string} channelId - Channel ID
     * @returns {Promise<boolean>} Whether commands were sent successfully
     */
    async sendWhWbCommands(client, channelId) {
        try {
            const whSent = await this.sendWhCommand(client, channelId);

            if (whSent) {
                // Delay between WH and WB
                await delay(getRandomInt(
                    this.config.messageDelay.MIN,
                    this.config.messageDelay.MAX
                ));

                // Send WB command
                const wbSent = await this.sendWbCommand(client, channelId);
                Loggers.Farm.info(`WH/WB commands sent to channel: ${channelId}`);

                return wbSent;
            }

            return false;
        } catch (error) {
            Loggers.Farm.error(`Error sending WH/WB commands: ${error.message}`);
            return false;
        }
    }

    /**
     * Get farming statistics
     * @returns {Object} Farming statistics
     */
    getStats() {
        return stateManager.getFarmingStats();
    }

    /**
     * Get random delay for loop iteration
     * @returns {number} Random delay in milliseconds
     */
    getRandomLoopDelay() {
        return getRandomInt(
            this.config.loopIterationDelay.MIN,
            this.config.loopIterationDelay.MAX
        );
    }

    /**
     * Get error recovery delay
     * @returns {number} Error recovery delay in milliseconds
     */
    getErrorRecoveryDelay() {
        return this.config.errorRecoveryDelay;
    }

    /**
     * Get critical error delay
     * @returns {number} Critical error delay in milliseconds
     */
    getCriticalErrorDelay() {
        return this.config.criticalErrorDelay;
    }

    /**
     * Get adjusted OWO delay (subtract typing and message delays)
     * @returns {number} Adjusted delay in milliseconds
     */
    getAdjustedOwoDelay() {
        const owoDelay = getRandomInt(
            this.config.owoDelay.MIN,
            this.config.owoDelay.MAX
        );
        const typingDelay = getRandomInt(
            this.config.typingDelay.MIN,
            this.config.typingDelay.MAX
        );
        const messageDelay = getRandomInt(
            this.config.messageDelay.MIN,
            this.config.messageDelay.MAX
        );
        return Math.max(0, owoDelay - typingDelay - messageDelay);
    }

    /**
     * Get adjusted WHWB delay (subtract typing and message delays)
     * @returns {number} Adjusted delay in milliseconds
     */
    getAdjustedWhWbDelay() {
        const whwbDelay = getRandomInt(
            this.config.whwbDelay.MIN,
            this.config.whwbDelay.MAX
        );
        const typingDelay = getRandomInt(
            this.config.typingDelay.MIN,
            this.config.typingDelay.MAX
        );
        const messageDelay = getRandomInt(
            this.config.messageDelay.MIN,
            this.config.messageDelay.MAX
        );
        return Math.max(0, whwbDelay - typingDelay - messageDelay);
    }

    /**
     * Get channel cycle delay
     * @returns {number} Random channel cycle delay in milliseconds
     */
    getChannelCycleDelay() {
        return getRandomInt(
            this.config.channelCycleDelay.MIN,
            this.config.channelCycleDelay.MAX
        );
    }
}

// ============================================================================
// GLOBAL FARMING SERVICE INSTANCE
// ============================================================================

/**
 * Global farming service instance
 * @type {FarmingService}
 */
const farmingService = new FarmingService();

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    FarmingService,
    farmingService
};
