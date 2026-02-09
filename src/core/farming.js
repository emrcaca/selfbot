const { botState, DELAYS, PROBABILITIES, shouldRunLoop } = require('./state');
const { sendTyping, sendMessage } = require('../services/discordService');
const { getRandomInt, delay, conditionalLog } = require('../utils/helpers');
const { logError } = require('../utils/errorHandler');
const { Loggers } = require('../utils/logger');
const { RETRY_DELAYS, RANDOM_DELAYS } = require('../constants/timeouts');

/**
 * Gets the active farming channel ID.
 * Priority: Temp Channel > Configured Channel List
 * @returns {string|null} Channel ID
 */
const getCurrentChannelId = () => {
    if (botState.tempFarmChannel) return botState.tempFarmChannel;
    if (!botState.channelIds.length) return null;
    return botState.channelIds[botState.currentChannelIndex];
};

/**
 * Executes a random sleep period if probability hits.
 */
async function randomSleep() {
    if (!shouldRunLoop() || Math.random() >= PROBABILITIES.SLEEP) return;

    botState.isSleeping = true;
    const duration = getRandomInt(DELAYS.SLEEP.MIN, DELAYS.SLEEP.MAX);
    
    Loggers.Farm.info(`Bot sleeping for ${Math.round(duration / 1000)}s`);
    await delay(duration);
    
    botState.isSleeping = false;
    Loggers.Farm.info('Bot woke up');
}

/**
 * Generic farming loop runner to reduce code duplication.
 * @param {Client} client - Discord client
 * @param {string} loopType - 'owo' or 'whwb'
 * @param {Function} actionFn - The farming action to perform
 */
async function runFarmLoop(client, loopType, actionFn) {
    const delayConfig = loopType === 'owo' ? DELAYS.OWO : DELAYS.WHWB;
    const processingFlag = loopType === 'owo' ? 'isProcessingOwo' : 'isProcessingWhWb';

    while (true) {
        try {
            // Initial random delay before each iteration
            await delay(getRandomInt(RANDOM_DELAYS.ITERATION_START.MIN, RANDOM_DELAYS.ITERATION_START.MAX));

            if (!shouldRunLoop(loopType)) continue;

            const channelId = getCurrentChannelId();
            if (!channelId) {
                // Wait before retrying if no channel available
                await delay(RETRY_DELAYS.NO_CHANNEL_RETRY);
                continue;
            }

            botState[processingFlag] = true;

            try {
                await actionFn(client, channelId);
                await randomSleep();
            } catch (error) {
                Loggers.Farm.error(`Error in ${loopType} loop: ${error.message}`);
                await delay(RETRY_DELAYS.FARM_ERROR_BACKOFF);
            } finally {
                botState[processingFlag] = false;
                // Wait for the configured command delay
                await delay(getRandomInt(delayConfig.MIN, delayConfig.MAX));
            }

        } catch (fatalError) {
            logError(`FARMING_${loopType.toUpperCase()}_LOOP`, fatalError);
            await delay(RETRY_DELAYS.FARM_FATAL_BACKOFF);
        }
    }
}

/**
 * Starts the OWO farming loop.
 * @param {Client} client 
 */
async function owoLoop(client) {
    await runFarmLoop(client, 'owo', async (c, channelId) => {
        await sendTyping(c, channelId);
        await sendMessage(c, channelId, "Owo");
        Loggers.Farm.info(`Owo sent in ${channelId}`);
    });
}

/**
 * Starts the WH/WB farming loop.
 * @param {Client} client 
 */
async function whwbLoop(client) {
    await runFarmLoop(client, 'whwb', async (c, channelId) => {
        await sendTyping(c, channelId);
        const sent = await sendMessage(c, channelId, "Owo h");
        
        if (sent) {
            await delay(getRandomInt(DELAYS.MESSAGE.MIN, DELAYS.MESSAGE.MAX));
            await sendTyping(c, channelId);
            await sendMessage(c, channelId, "Owo b");
            Loggers.Farm.info(`Wh/Wb sent in ${channelId}`);
        }
    });
}

/**
 * Cycle through configured channels periodically.
 * @param {Client} client 
 */
async function cycleChannels(client) {
    // Only cycle if multiple channels exist and no temp channel is forced
    if (botState.tempFarmChannel || botState.channelIds.length <= 1) return;

    while (true) {
        try {
            const cycleDelay = getRandomInt(DELAYS.CHANNEL_CYCLE.MIN, DELAYS.CHANNEL_CYCLE.MAX);
            await delay(cycleDelay);

            if (shouldRunLoop() && !botState.tempFarmChannel && botState.channelIds.length > 1) {
                const oldChannel = botState.channelIds[botState.currentChannelIndex];
                
                // Move to next channel
                botState.currentChannelIndex = (botState.currentChannelIndex + 1) % botState.channelIds.length;
                
                const newChannel = botState.channelIds[botState.currentChannelIndex];
                Loggers.Farm.info(`Channel cycled: ${oldChannel} -> ${newChannel}`);
            }
        } catch (error) {
            Loggers.Farm.error(`Channel cycle error: ${error.message}`);
            await delay(RETRY_DELAYS.CHANNEL_CYCLE_ERROR_BACKOFF);
        }
    }
}

module.exports = {
    owoLoop,
    whwbLoop,
    cycleChannels,
    getCurrentChannelId
};
