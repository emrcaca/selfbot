const { botState, DELAYS, PROBABILITIES } = require('./state');
const { shouldRunLoop } = require('./state');
const { sendTyping, sendMessage, setTrackedTimeout, clearAllCaches } = require('../services/discordService');
const { getRandomInt, delay } = require('../utils/helpers');
const { logError } = require('../utils/errorHandler');
const { Loggers } = require('../utils/logger');

/**
 * Get the current channel ID for farming
 * @returns {string|null} Channel ID or null if none available
 */
const getCurrentChannelId = () => {
    if (botState.tempFarmChannel) {
        return botState.tempFarmChannel;
    }
    if (botState.channelIds.length === 0) {
        return null;
    }
    return botState.channelIds[botState.currentChannelIndex];
};

/**
 * Random sleep functionality for the bot
 * @returns {Promise<void>}
 */
async function randomSleep() {
    if (shouldRunLoop() && Math.random() < PROBABILITIES.SLEEP) {
        botState.isSleeping = true;
        const sleepDuration = getRandomInt(DELAYS.SLEEP.MIN, DELAYS.SLEEP.MAX);
        Loggers.Farm.info(`Bot entering sleep mode for ${Math.round(sleepDuration / 1000)}s`);

        // Wait for the sleep duration
        await delay(sleepDuration);

        botState.isSleeping = false;
        Loggers.Farm.info(`Bot woke up from sleep`);
    }
}

/**
 * Main loop for OWO farming
 * @param {Client} client - Discord client instance
 * @returns {Promise<void>}
 */
async function owoLoop(client) {
    while (true) {
        try {
            await delay(getRandomInt(500, 2000));
            if (!shouldRunLoop('owo')) continue;

            const channelId = getCurrentChannelId();
            if (!channelId) continue;

            botState.isProcessingOwo = true;
            try {
                await sendTyping(client, channelId);
                await sendMessage(client, channelId, "Owo");
                Loggers.Farm.info(`Owo command sent. Channel: ${channelId}`);
                await randomSleep();
            } catch (error) {
                // Log error but continue looping
                Loggers.Farm.error(`Error sending Owo command: ${error.message}`);
                await delay(5000);
            } finally {
                botState.isProcessingOwo = false;
                await delay(getRandomInt(DELAYS.OWO.MIN, DELAYS.OWO.MAX));
            }
        } catch (error) {
            // Log error but continue looping
            logError('FARMING_OWO_LOOP', error);
            await delay(10000);
        }
    }
}

/**
 * Main loop for WHWB farming
 * @param {Client} client - Discord client instance
 * @returns {Promise<void>}
 */
async function whwbLoop(client) {
    while (true) {
        try {
            await delay(getRandomInt(500, 2000));
            if (!shouldRunLoop('whwb')) continue;

            const channelId = getCurrentChannelId();
            if (!channelId) continue;

            botState.isProcessingWhWb = true;
            try {
                await sendTyping(client, channelId);
                if (await sendMessage(client, channelId, "Owo h")) {
                    await delay(getRandomInt(DELAYS.MESSAGE.MIN, DELAYS.MESSAGE.MAX));
                    await sendTyping(client, channelId);
                    await sendMessage(client, channelId, "Owo b");
                    Loggers.Farm.info(`Wh/Wb commands sent. Channel: ${channelId}`);
                }
                await randomSleep();
            } catch (error) {
                // Log error but continue looping
                Loggers.Farm.error(`Error sending Wh/Wb commands: ${error.message}`);
                await delay(5000);
            } finally {
                botState.isProcessingWhWb = false;
                await delay(getRandomInt(DELAYS.WHWB.MIN, DELAYS.WHWB.MAX));
            }
        } catch (error) {
            // Log error but continue looping
            await delay(10000);
        }
    }
}

/**
 * Channel cycling functionality
 * @param {Client} client - Discord client instance
 * @returns {Promise<void>}
 */
async function cycleChannels(client) {
    if (botState.tempFarmChannel || botState.channelIds.length <= 1) return;
    
    while (true) {
        try {
            // Wait for the cycle delay
            const cycleDelay = getRandomInt(DELAYS.CHANNEL_CYCLE.MIN, DELAYS.CHANNEL_CYCLE.MAX);
            await delay(cycleDelay);
            
            // Check if we should cycle channels
            if (shouldRunLoop() && !botState.tempFarmChannel && botState.channelIds.length > 1 && client?.user) {
                const oldChannelId = botState.channelIds[botState.currentChannelIndex];
                botState.currentChannelIndex = (botState.currentChannelIndex + 1) % botState.channelIds.length;
                const newChannelId = botState.channelIds[botState.currentChannelIndex];
                Loggers.Farm.info(`Channel switched. Old: ${oldChannelId}, New: ${newChannelId}`);
            }
        } catch (error) {
            // Log error but continue looping
            Loggers.Farm.error(`Channel cycling error: ${error.message}`);
            await delay(10000);
        }
    }
}

module.exports = {
    owoLoop,
    whwbLoop,
    cycleChannels,
    getCurrentChannelId
};