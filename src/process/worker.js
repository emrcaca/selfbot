/**
 * Selfbot Worker Process
 *
 * This is the worker process that runs as a child of the main process.
 * It handles the actual Discord selfbot operations including farming,
 * message handling, and command processing.
 *
 * @module process/worker
 */

const { Client } = require('discord.js-selfbot-v13');
const configManager = require('../config/manager');
const { botState, resumeBot, stopBot, toggleBooleanState, initializeConfig } = require('../core/state');
const { owoLoop, whwbLoop, cycleChannels } = require('../core/farming');
const { handleIncomingMessage, handleCaptchaDM, clearCaptchaState } = require('../handlers/messageHandler');
const { handleUncaughtException, handleUnhandledRejection } = require('../utils/errorHandler');
const { clearAllTrackedTimeouts } = require('../services/discordService');
const { Loggers } = require('../utils/logger');

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum time to farm in a single channel (ms) */
const MAX_FARM_TIME_PER_CHANNEL = 10 * 60 * 1000; // 10 minutes

/** Regular expression for validating Discord channel IDs */
const DISCORD_CHANNEL_ID_REGEX = /^\d+$/;

// ============================================================================
// INITIALIZATION
// ============================================================================

// Fix for self-signed certificate error
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Set up global error handlers
process.on('uncaughtException', handleUncaughtException);
process.on('unhandledRejection', handleUnhandledRejection);

// Get the token from command line arguments
const token = process.argv[2];

if (!token) {
    console.error('[WORKER] No token provided');
    process.exit(1);
}

// Initialize Discord client
const client = new Client({
    checkUpdate: false,
    ws: { properties: { $browser: 'Discord iOS' } }
});

// ============================================================================
// STARTUP
// ============================================================================

/**
 * Initialize and start the selfbot worker
 */
async function initializeWorker() {
    try {
        // Load configuration first
        const config = await configManager.loadConfig();
        initializeConfig(config);

        // Then login to Discord
        await client.login(token);

    } catch (error) {
        console.error('[WORKER] Failed to start selfbot:', error.message);
        process.exit(1);
    }
}

// ============================================================================
// DISCORD EVENT HANDLERS
// ============================================================================

/**
 * Handle client ready event
 */
client.on('ready', async () => {
    // Notify main process that we're ready
    if (process.send) {
        process.send({
            type: 'selfbot_ready',
            userId: client.user.id
        });
    }

    // Log ready message based on configuration
    if (botState.enableConsoleLog) {
        console.log(`[WORKER] Selfbot logged in as ${client.user.tag}`);
    }

    // Start farming loops
    owoLoop(client);
    whwbLoop(client);
    cycleChannels(client);

    // Resume bot if no CAPTCHA detected
    if (!botState.captchaDetected) {
        resumeBot();
    }
});

/**
 * Handle message creation event
 */
client.on('messageCreate', async message => {
    try {
        await handleIncomingMessage(client, message);
        await handleCaptchaDM(client, message);
    } catch (error) {
        Loggers.Bot.error(`Error handling message: ${error.message}`);
    }
});

/**
 * Handle client error event
 */
client.on('error', error => {
    console.error('[WORKER] Client error:', error);
});

// ============================================================================
// COMMAND PROCESSING
// ============================================================================

/**
 * Handle messages from the main process
 */
process.on('message', (message) => {
    switch (message.type) {
        case 'komut_kullanildi':
            handleCommand(message);
            break;

        case 'channels_command':
            handleChannelsCommand(message);
            break;

        default:
            Loggers.Bot.debug(`Unknown message type from main process: ${message.type}`);
    }
});

/**
 * Handle farm-related commands
 *
 * @param {Object} message - Command message from main process
 */
function handleCommand(message) {
    try {
        let resultMessage = '';

        switch (message.command) {
            case 'farm':
                resultMessage = handleFarmCommand(message);
                break;

            default:
                resultMessage = 'Unknown command';
        }

        // Send result back to main process
        if (process.send) {
            process.send({
                type: 'komut_sonucu',
                resultMessage,
                interactionId: message.interactionId,
                isOwoEnabled: botState.isOwoEnabled
            });
        }

    } catch (error) {
        console.error('[WORKER] Command processing error:', error);

        if (process.send) {
            process.send({
                type: 'komut_sonucu',
                resultMessage: 'An error occurred while processing the command.',
                interactionId: message.interactionId
            });
        }
    }
}

/**
 * Handle the farm command
 *
 * Handles both temporary farm (this channel) and permanent farm
 * (channel list) operations.
 *
 * @param {Object} message - Command message
 * @returns {string} Result message
 */
function handleFarmCommand(message) {
    const { farmType, channelId } = message;

    switch (farmType) {
        case 'this_channel':
            return handleTemporaryFarm(channelId);

        case 'permanent_channels':
            return handlePermanentFarm();

        default:
            return 'Invalid farm type';
    }
}

/**
 * Handle temporary farm (this channel) command
 *
 * Starts or stops farming in the specified channel with a time limit.
 *
 * @param {string} channelId - Channel ID to farm in
 * @returns {string} Result message
 */
function handleTemporaryFarm(channelId) {
    // Initialize channel timer if not exists
    if (!botState.timedChannels[channelId]) {
        botState.timedChannels[channelId] = { elapsed: 0 };
    }

    const channelTimer = botState.timedChannels[channelId];

    // Check if time limit has been reached
    if (channelTimer.elapsed >= MAX_FARM_TIME_PER_CHANNEL) {
        return 'You have farmed in this channel for 10 minutes. Please switch to another channel.';
    }

    // Handle switching from another channel
    if (botState.activeTimedFarm.channelId && botState.activeTimedFarm.channelId !== channelId) {
        // Clear previous timeout
        if (botState.activeTimedFarm.timeoutId) {
            clearTimeout(botState.activeTimedFarm.timeoutId);
        }

        // Update elapsed time for previous channel
        const oldChannelId = botState.activeTimedFarm.channelId;
        if (botState.timedChannels[oldChannelId] && botState.activeTimedFarm.startTime) {
            const elapsedThisSession = Date.now() - botState.activeTimedFarm.startTime;
            botState.timedChannels[oldChannelId].elapsed += elapsedThisSession;

            // Reset if limit reached
            if (botState.timedChannels[oldChannelId].elapsed >= MAX_FARM_TIME_PER_CHANNEL) {
                botState.timedChannels[oldChannelId].elapsed = 0;
            }
        }

        // Reset active farm
        botState.activeTimedFarm = { channelId: null, startTime: null, timeoutId: null };
    }

    // Determine if we're starting or stopping
    const isStarting = !botState.isOwoEnabled || botState.activeTimedFarm.channelId !== channelId;
    botState.isOwoEnabled = isStarting;

    if (isStarting) {
        return startTemporaryFarm(channelId, channelTimer);
    } else {
        return stopTemporaryFarm(channelId, channelTimer);
    }
}

/**
 * Start temporary farm in a channel
 *
 * @param {string} channelId - Channel ID
 * @param {Object} channelTimer - Channel timer object
 * @returns {string} Result message
 */
function startTemporaryFarm(channelId, channelTimer) {
    // Reset all channels that have reached the time limit
    try {
        for (const [chanId, timer] of Object.entries(botState.timedChannels)) {
            if (timer && typeof timer.elapsed === 'number' && timer.elapsed >= MAX_FARM_TIME_PER_CHANNEL) {
                botState.timedChannels[chanId].elapsed = 0;
            }
        }
    } catch (error) {
        Loggers.Bot.error('Error resetting channel timers:', error);
    }

    // Calculate remaining time
    const remainingTime = MAX_FARM_TIME_PER_CHANNEL - channelTimer.elapsed;
    const remainingMinutes = Math.round(remainingTime / 60000);

    // Set up timeout to stop farming
    botState.activeTimedFarm = {
        channelId: channelId,
        startTime: Date.now(),
        timeoutId: setTimeout(() => {
            if (botState.activeTimedFarm.channelId === channelId) {
                stopBot();
                botState.isOwoEnabled = false;
                channelTimer.elapsed = 0;
                botState.activeTimedFarm = { channelId: null, startTime: null, timeoutId: null };
                botState.tempFarmChannel = null;
            }
        }, remainingTime)
    };

    // Set temporary farm channel
    botState.tempFarmChannel = channelId;

    // Resume bot
    resumeBot();

    return `Farm started in this channel. Remaining time: ${remainingMinutes} minute(s).`;
}

/**
 * Stop temporary farm in a channel
 *
 * @param {string} channelId - Channel ID
 * @param {Object} channelTimer - Channel timer object
 * @returns {string} Result message
 */
function stopTemporaryFarm(channelId, channelTimer) {
    // Clear timeout
    if (botState.activeTimedFarm.timeoutId) {
        clearTimeout(botState.activeTimedFarm.timeoutId);
    }

    // Update elapsed time
    const startTime = botState.activeTimedFarm.startTime;
    if (startTime) {
        channelTimer.elapsed += (Date.now() - startTime);
    }

    // Reset active farm
    botState.activeTimedFarm = { channelId: null, startTime: null, timeoutId: null };
    botState.tempFarmChannel = null;

    // Stop bot
    stopBot();
    botState.isOwoEnabled = false;

    return 'Farm stopped.';
}

/**
 * Handle permanent farm command
 *
 * Toggles farming on all channels in the permanent list.
 *
 * @returns {string} Result message
 */
function handlePermanentFarm() {
    // Check if there are channels to farm
    if (botState.channelIds.length === 0) {
        return 'No channels in the permanent list. Please add channels first.';
    }

    // Toggle farming
    toggleBooleanState('isOwoEnabled', 'Owo Farm');

    if (botState.isOwoEnabled) {
        resumeBot();
        return 'Farming enabled for permanent channels. Will start shortly.';
    } else {
        stopBot();
        return 'Farming disabled.';
    }
}

/**
 * Handle channels command
 *
 * Manages the permanent channel list (add/clear).
 *
 * @param {Object} message - Command message
 */
function handleChannelsCommand(message) {
    try {
        let resultMessage = '';

        switch (message.action) {
            case 'add':
                resultMessage = handleAddChannels(message.channelIds);
                break;

            case 'clear':
                resultMessage = handleClearChannels();
                break;

            default:
                resultMessage = 'Invalid action.';
        }

        // Send result back to main process
        if (process.send) {
            process.send({
                type: 'komut_sonucu',
                resultMessage,
                interactionId: message.interactionId
            });
        }

    } catch (error) {
        console.error('[WORKER] Channels command processing error:', error);

        if (process.send) {
            process.send({
                type: 'komut_sonucu',
                resultMessage: 'An error occurred while processing the channels command.',
                interactionId: message.interactionId
            });
        }
    }
}

/**
 * Handle adding channels to the permanent list
 *
 * @param {string} channelIdsString - Comma-separated channel IDs
 * @returns {string} Result message
 */
function handleAddChannels(channelIdsString) {
    if (!channelIdsString) {
        return 'Channel IDs must be specified.';
    }

    // Parse and validate channel IDs
    const channelIds = channelIdsString
        .split(',')
        .map(id => id.trim())
        .filter(id => id.length > 0);

    const validChannelIds = [];
    const invalidChannelIds = [];

    for (const id of channelIds) {
        // Check if ID is numeric
        if (DISCORD_CHANNEL_ID_REGEX.test(id)) {
            validChannelIds.push(id);
        } else {
            invalidChannelIds.push(id);
        }
    }

    if (invalidChannelIds.length > 0) {
        return `Invalid channel IDs: ${invalidChannelIds.join(', ')}. Only numeric values are accepted.`;
    }

    // Remove duplicates and add to list
    const newChannels = validChannelIds.filter(id => !botState.channelIds.includes(id));
    botState.channelIds = [...botState.channelIds, ...newChannels];

    return `${newChannels.length} channel(s) added successfully. Total channels: ${botState.channelIds.length}`;
}

/**
 * Handle clearing the permanent channel list
 *
 * @returns {string} Result message
 */
function handleClearChannels() {
    botState.channelIds = [];
    return 'Permanent channel list cleared successfully.';
}

// ============================================================================
// SHUTDOWN
// ============================================================================

/**
 * Graceful shutdown function
 */
async function shutdown() {
    Loggers.Bot.info('Shutting down worker...');

    stopBot(false);
    await clearCaptchaState('Shutdown');
    clearAllTrackedTimeouts();
    client.destroy();

    process.exit(0);
}

// Register shutdown handlers
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Additional error handlers for the worker process
process.on('uncaughtException', (error) => {
    console.error('[WORKER] Uncaught exception:', error);
    stopBot(false);
});

process.on('unhandledRejection', (reason) => {
    console.error('[WORKER] Unhandled rejection:', reason);
    stopBot(false);
});

// ============================================================================
// START WORKER
// ============================================================================

initializeWorker();