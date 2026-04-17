/**
 * Farming Module
 *
 * Handles all farming operations including OWO commands, WHWB commands,
 * channel cycling, and random sleep intervals to make the bot behavior
 * appear more natural.
 *
 * @module core/farming
 */

const { botState, DELAYS, PROBABILITIES } = require('./state');
const { shouldRunLoop } = require('./state');
const { sendTyping, sendMessage } = require('../services/discordService');
const { getRandomInt, delay } = require('../utils/helpers');
const { logError } = require('../utils/errorHandler');
const { Loggers } = require('../utils/logger');

// ============================================================================
// CONSTANTS
// ============================================================================

/** Command strings for farming */
const COMMANDS = {
    OWO: 'Owo',
    WH: 'Owo h',
    WB: 'Owo b'
};

/** Delay ranges in milliseconds */
const LOOP_DELAYS = {
    /** Delay between loop iterations */
    ITERATION: { MIN: 200, MAX: 1000 },
    /** Delay after errors */
    ERROR_RECOVERY: 5000,
    /** Delay after critical errors */
    CRITICAL_ERROR: 10000
};

// ============================================================================
// CHANNEL MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Get the current channel ID for farming
 *
 * Returns the temporary farm channel if set, otherwise returns
 * the current channel from the rotation list.
 *
 * @returns {string|null} Channel ID or null if none available
 */
function getCurrentChannelId() {
    // Priority: temporary farm channel > rotation list
    if (botState.tempFarmChannel) {
        return botState.tempFarmChannel;
    }

    if (botState.channelIds.length === 0) {
        return null;
    }

    return botState.channelIds[botState.currentChannelIndex];
}

/**
 * Advance to the next channel in the rotation
 *
 * Moves the current channel index to the next position in the
 * channel list, wrapping around to the beginning if necessary.
 *
 * @returns {string|null} New channel ID or null if no channels available
 */
function advanceToNextChannel() {
    if (botState.channelIds.length === 0) {
        return null;
    }

    const oldChannelId = botState.channelIds[botState.currentChannelIndex];
    botState.currentChannelIndex = (botState.currentChannelIndex + 1) % botState.channelIds.length;
    const newChannelId = botState.channelIds[botState.currentChannelIndex];

    Loggers.Farm.info(`Channel advanced. Old: ${oldChannelId}, New: ${newChannelId}`);

    return newChannelId;
}

// ============================================================================
// SLEEP MANAGEMENT
// ============================================================================

/**
 * Random sleep functionality for the bot
 *
 * Randomly enters sleep mode based on the sleep probability
 * configuration. This makes the bot appear more natural by
 * taking breaks at random intervals.
 *
 * @returns {Promise<void>}
 */
async function performRandomSleep() {
    if (!shouldRunLoop()) {
        return;
    }

    // Only sleep based on probability
    if (Math.random() >= PROBABILITIES.SLEEP) {
        return;
    }

    botState.isSleeping = true;

    const sleepDuration = getRandomInt(DELAYS.SLEEP.MIN, DELAYS.SLEEP.MAX);
    const sleepDurationSeconds = Math.round(sleepDuration / 1000);

    Loggers.Farm.info(`Bot entering sleep mode for ${sleepDurationSeconds}s`);

    try {
        await delay(sleepDuration);
    } finally {
        botState.isSleeping = false;
        Loggers.Farm.info('Bot woke up from sleep');
    }
}

// ============================================================================
// FARMING LOOPS
// ============================================================================

/**
 * Main loop for OWO farming
 *
 * Continuously sends the OWO command to the current farming channel.
 * Includes random delays, typing indicators, and error handling.
 *
 * @param {Client} client - Discord client instance
 * @returns {Promise<void>} Never resolves (runs indefinitely)
 */
async function owoLoop(client) {
    Loggers.Farm.info('Starting OWO farming loop');

    while (true) {
        try {
            // Random delay between iterations
            await delay(getRandomInt(LOOP_DELAYS.ITERATION.MIN, LOOP_DELAYS.ITERATION.MAX));

            // Check if we should continue the loop
            if (!shouldRunLoop('owo')) {
                continue;
            }

            // Get the current channel
            const channelId = getCurrentChannelId();
            if (!channelId) {
                continue;
            }

            // Mark as processing
            botState.isProcessingOwo = true;

            try {
                // Send typing indicator (randomly based on probability)
                await sendTyping(client, channelId);

                // Send OWO command
                await sendMessage(client, channelId, COMMANDS.OWO);
                Loggers.Farm.info(`OWO command sent to channel: ${channelId}`);

                // Random sleep after command
                await performRandomSleep();

            } catch (error) {
                Loggers.Farm.error(`Error sending OWO command: ${error.message}`);
                await delay(LOOP_DELAYS.ERROR_RECOVERY);
            } finally {
                botState.isProcessingOwo = false;

                // Calculate adjusted delay (subtract typing and message delays from OWO delay)
                const owoDelay = getRandomInt(DELAYS.OWO.MIN, DELAYS.OWO.MAX);
                const typingDelay = getRandomInt(DELAYS.TYPING.MIN, DELAYS.TYPING.MAX);
                const messageDelay = getRandomInt(DELAYS.MESSAGE.MIN, DELAYS.MESSAGE.MAX);
                const adjustedDelay = Math.max(0, owoDelay - typingDelay - messageDelay);
                await delay(adjustedDelay);
            }

        } catch (error) {
            logError('FARMING_OWO_LOOP', error);
            await delay(LOOP_DELAYS.CRITICAL_ERROR);
        }
    }
}

/**
 * Main loop for WHWB farming
 *
 * Continuously sends the WH and WB commands to the current farming channel.
 * These commands are sent in sequence with a short delay between them.
 *
 * @param {Client} client - Discord client instance
 * @returns {Promise<void>} Never resolves (runs indefinitely)
 */
async function whwbLoop(client) {
    Loggers.Farm.info('Starting WHWB farming loop');

    while (true) {
        try {
            // Random delay between iterations
            await delay(getRandomInt(LOOP_DELAYS.ITERATION.MIN, LOOP_DELAYS.ITERATION.MAX));

            // Check if we should continue the loop
            if (!shouldRunLoop('whwb')) {
                continue;
            }

            // Get the current channel
            const channelId = getCurrentChannelId();
            if (!channelId) {
                continue;
            }

            // Mark as processing
            botState.isProcessingWhWb = true;

            try {
                // Send typing indicator
                await sendTyping(client, channelId);

                // Send WH command
                const whSent = await sendMessage(client, channelId, COMMANDS.WH);

                if (whSent) {
                    // Delay between WH and WB
                    await delay(getRandomInt(DELAYS.MESSAGE.MIN, DELAYS.MESSAGE.MAX));

                    // Send typing indicator before WB
                    await sendTyping(client, channelId);

                    // Send WB command
                    await sendMessage(client, channelId, COMMANDS.WB);
                    Loggers.Farm.info(`WH/WB commands sent to channel: ${channelId}`);
                }

                // Random sleep after commands
                await performRandomSleep();

            } catch (error) {
                Loggers.Farm.error(`Error sending WH/WB commands: ${error.message}`);
                await delay(LOOP_DELAYS.ERROR_RECOVERY);
            } finally {
                botState.isProcessingWhWb = false;

                // Calculate adjusted delay (subtract typing and message delays from WHWB delay)
                const whwbDelay = getRandomInt(DELAYS.WHWB.MIN, DELAYS.WHWB.MAX);
                const typingDelay = getRandomInt(DELAYS.TYPING.MIN, DELAYS.TYPING.MAX);
                const messageDelay = getRandomInt(DELAYS.MESSAGE.MIN, DELAYS.MESSAGE.MAX);
                const adjustedDelay = Math.max(0, whwbDelay - typingDelay - messageDelay);
                await delay(adjustedDelay);
            }

        } catch (error) {
            logError('FARMING_WHWB_LOOP', error);
            await delay(LOOP_DELAYS.CRITICAL_ERROR);
        }
    }
}

/**
 * Channel cycling functionality
 *
 * Periodically advances to the next channel in the rotation list.
 * This is useful for distributing farming across multiple channels.
 *
 * @param {Client} client - Discord client instance
 * @returns {Promise<void>} Never resolves (runs indefinitely)
 */
async function cycleChannels(client) {
    // Don't start cycling if using temporary farm or only one channel
    if (botState.tempFarmChannel || botState.channelIds.length <= 1) {
        Loggers.Farm.info('Channel cycling disabled (temporary farm or single channel)');
        return;
    }

    Loggers.Farm.info('Starting channel cycling loop');

    while (true) {
        try {
            // Wait for the cycle delay
            const cycleDelay = getRandomInt(DELAYS.CHANNEL_CYCLE.MIN, DELAYS.CHANNEL_CYCLE.MAX);
            await delay(cycleDelay);

            // Check if we should cycle channels
            if (!shouldRunLoop()) {
                continue;
            }

            // Don't cycle if using temporary farm channel
            if (botState.tempFarmChannel) {
                continue;
            }

            // Don't cycle if only one channel
            if (botState.channelIds.length <= 1) {
                continue;
            }

            // Ensure client is ready
            if (!client?.user) {
                continue;
            }

            // Advance to next channel
            advanceToNextChannel();

        } catch (error) {
            Loggers.Farm.error(`Channel cycling error: ${error.message}`);
            await delay(LOOP_DELAYS.CRITICAL_ERROR);
        }
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get farming statistics
 *
 * Returns information about the current farming state.
 *
 * @returns {Object} Farming statistics
 */
function getFarmingStats() {
    return {
        isRunning: botState.isRunning,
        isOwoEnabled: botState.isOwoEnabled,
        isSleeping: botState.isSleeping,
        isProcessingOwo: botState.isProcessingOwo,
        isProcessingWhWb: botState.isProcessingWhWb,
        currentChannel: getCurrentChannelId(),
        channelCount: botState.channelIds.length,
        tempFarmChannel: botState.tempFarmChannel
    };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    // Main loops
    owoLoop,
    whwbLoop,
    cycleChannels,

    // Channel management
    getCurrentChannelId,
    advanceToNextChannel,

    // Utility functions
    performRandomSleep,
    getFarmingStats
};
