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
const { botState, resumeBot, stopBot, toggleBooleanState, initializeConfig, setUserChannelList, getUserChannelList, hasUserChannelList, removeUserChannelList } = require('../core/state');
const { owoLoop, whwbLoop, cycleChannels } = require('../core/farming');
const { handleIncomingMessage, handleCaptchaDM, clearCaptchaState } = require('../handlers/messageHandler');
const { handleUncaughtException, handleUnhandledRejection } = require('../utils/errorHandler');
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
if (process.env.NODE_ENV === 'development') {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    Loggers.Bot.warn('SSL verification is disabled in development mode.');
}

// Set up global error handlers
process.on('uncaughtException', handleUncaughtException);
process.on('unhandledRejection', handleUnhandledRejection);

// Get the token from command line arguments
const token = process.argv[2];

if (!token) {
    Loggers.Bot.error('No token provided');
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
        Loggers.Bot.error(`Failed to start selfbot: ${error.message}`);
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
        Loggers.Bot.info(`Selfbot logged in as ${client.user.tag}`);
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
    Loggers.Bot.error(`Client error: ${error.message}`);
});

// ============================================================================
// COMMAND PROCESSING
// ============================================================================

/**
 * Handle messages from the main process
 */
process.on('message', async (message) => {
    switch (message.type) {
        case 'komut_kullanildi':
            await handleCommand(message);
            break;

        case 'channels_command':
            handleChannelsCommand(message);
            break;

        case 'setch_command':
            handleSetchCommand(message);
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
async function handleCommand(message) {
    try {
        let resultMessage = '';

        switch (message.command) {
            case 'farm':
                resultMessage = await handleFarmCommand(message);
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

            // Also send OWO status update to update button states
            process.send({
                type: 'owo_status_update',
                isOwoEnabled: botState.isOwoEnabled
            });

            // Send farm status update based on actual state, not result message parsing
            // This ensures consistency between state and UI
            let isChannelFarming = false;
            let isPermanentFarming = false;
            let activeChannelId = null;

            if (botState.tempFarmChannel) {
                // Temporary farm is active
                isChannelFarming = true;
                isPermanentFarming = false;
                activeChannelId = botState.tempFarmChannel;
            } else if (botState.isOwoEnabled) {
                // Permanent farm is active (no temp farm, but isOwoEnabled is true)
                isPermanentFarming = true;
                isChannelFarming = false;
            }

            // Send detailed farm status update including channel ID and tempFarmChannel
            process.send({
                type: 'farm_status_update',
                userId: client.user.id,
                isChannelFarming,
                isPermanentFarming,
                channelId: activeChannelId,
                tempFarmChannel: botState.tempFarmChannel
            });
        }

    } catch (error) {
        Loggers.Bot.error(`Command processing error: ${error.message}`);

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
 * @returns {Promise<string>} Result message
 */
async function handleFarmCommand(message) {
    const { farmType, channelId, targetUserId } = message;

    switch (farmType) {
        case 'this_channel':
            return handleTemporaryFarm(channelId);

        case 'permanent_channels':
            return await handlePermanentFarm(targetUserId);

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

        // Restore original channel IDs if they were stored
        if (botState.activeTimedFarm.originalChannelIds) {
            botState.channelIds = botState.activeTimedFarm.originalChannelIds;
            botState.currentChannelIndex = botState.activeTimedFarm.originalChannelIndex || 0;
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

    // Store original channel IDs before modifying
    const originalChannelIds = botState.channelIds;
    const originalChannelIndex = botState.currentChannelIndex;

    // Calculate remaining time
    const remainingTime = MAX_FARM_TIME_PER_CHANNEL - channelTimer.elapsed;
    const remainingMinutes = Math.round(remainingTime / 60000);

    // Set up timeout to stop farming
    botState.activeTimedFarm = {
        channelId: channelId,
        startTime: Date.now(),
        originalChannelIds: originalChannelIds,
        originalChannelIndex: originalChannelIndex,
        timeoutId: setTimeout(() => {
            if (botState.activeTimedFarm.channelId === channelId) {
                stopBot();
                botState.isOwoEnabled = false;
                channelTimer.elapsed = 0;

                if (botState.activeTimedFarm.originalChannelIds) {
                    botState.channelIds = botState.activeTimedFarm.originalChannelIds;
                    botState.currentChannelIndex = botState.activeTimedFarm.originalChannelIndex || 0;
                }

                botState.activeTimedFarm = { channelId: null, startTime: null, timeoutId: null };
                botState.tempFarmChannel = null;

                if (process.send) {
                    process.send({
                        type: 'owo_status_update',
                        isOwoEnabled: false
                    });

                    process.send({
                        type: 'farm_status_update',
                        userId: client.user.id,
                        isChannelFarming: false,
                        isPermanentFarming: false,
                        channelId: null,
                        tempFarmChannel: null
                    });
                }
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
function stopTemporaryFarm(_channelId, channelTimer) {
    // Clear timeout
    if (botState.activeTimedFarm.timeoutId) {
        clearTimeout(botState.activeTimedFarm.timeoutId);
    }

    // Update elapsed time
    const startTime = botState.activeTimedFarm.startTime;
    if (startTime) {
        channelTimer.elapsed += (Date.now() - startTime);
    }

    // Restore original channel IDs
    if (botState.activeTimedFarm.originalChannelIds) {
        botState.channelIds = botState.activeTimedFarm.originalChannelIds;
        botState.currentChannelIndex = botState.activeTimedFarm.originalChannelIndex || 0;
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
 * Uses user-specific channel list if available, otherwise uses default list.
 *
 * @param {string} userId - User ID for getting user-specific channel list
 * @returns {Promise<string>} Result message
 */
async function handlePermanentFarm(userId) {
    // Get user-specific channel list if available
    let channelList = botState.channelIds;
    let channelSource = 'global';

    if (userId && hasUserChannelList(userId)) {
        channelList = getUserChannelList(userId);
        channelSource = 'custom';
    }

    // Check if there are channels to farm
    if (channelList.length === 0) {
        return 'No channels in the permanent list. Please add channels first using /setch or /channels add.';
    }

    // Temporary override the channel list for this user
    const originalChannelIds = botState.channelIds;
    const originalChannelIndex = botState.currentChannelIndex;

    // Use user-specific channel list
    if (userId && hasUserChannelList(userId)) {
        botState.channelIds = getUserChannelList(userId);
        botState.currentChannelIndex = 0;
    }

    // Toggle farming
    toggleBooleanState('isOwoEnabled', 'Owo Farm');

    if (botState.isOwoEnabled) {
        // Check if selfbot can send messages to any channel
        let hasAccess = false;
        for (const channelId of channelList) {
            const channel = client.channels.cache.get(channelId);
            if (channel && channel.viewable && channel.permissionsFor(client.user).has('SendMessages')) {
                hasAccess = true;
                break;
            }
        }

        if (!hasAccess) {
            // No access to any channel, revert the change
            botState.isOwoEnabled = false;
            stopBot();
            if (userId && hasUserChannelList(userId)) {
                botState.channelIds = originalChannelIds;
                botState.currentChannelIndex = originalChannelIndex;
            }
            return 'You do not have access to any of the permanent channels. Please check your permissions or add different channels.';
        }

        // Stop temporary farm when starting permanent farm
        if (botState.activeTimedFarm.timeoutId) {
            clearTimeout(botState.activeTimedFarm.timeoutId);
        }
        botState.activeTimedFarm = { channelId: null, startTime: null, timeoutId: null };
        botState.tempFarmChannel = null;

        resumeBot();
        return `Farming enabled for permanent channels (${channelSource} list with ${channelList.length} channel(s)). Will start shortly.`;
    } else {
        stopBot();
        // Restore original channel list
        botState.channelIds = originalChannelIds;
        botState.currentChannelIndex = originalChannelIndex;
        return 'Farming disabled.';
    }
}

/**
 * Send a command result back to the main process
 *
 * @param {string} resultMessage - Result message to send
 * @param {string} interactionId - Interaction ID for routing the response
 */
function sendCommandResult(resultMessage, interactionId) {
    if (process.send) {
        process.send({
            type: 'komut_sonucu',
            resultMessage,
            interactionId
        });
    }
}

/**
 * Handle setch command - Set custom channel list for user or reset to default
 *
 * @param {Object} message - Command message
 * @returns {string} Result message
 */
function handleSetchCommand(message) {
    const { action, channelIds, interactionId, targetUserId } = message;

    let resultMessage = '';

    if (action === 'default') {
        // Remove user-specific channel list (reset to default)
        if (removeUserChannelList(targetUserId)) {
            resultMessage = 'Successfully reset to default channel list.';
        } else {
            resultMessage = 'No custom channel list found. Already using default list.';
        }

        sendCommandResult(resultMessage, interactionId);
        return resultMessage;
    }

    // Set action
    if (!channelIds || channelIds.trim().length === 0) {
        resultMessage = 'No channel IDs provided.';
        sendCommandResult(resultMessage, interactionId);
        return resultMessage;
    }

    // Parse channel IDs
    const parsedChannelIds = channelIds
        .split(',')
        .map(id => id.trim())
        .filter(id => id.length > 0);

    if (parsedChannelIds.length === 0) {
        resultMessage = 'No valid channel IDs provided.';
        sendCommandResult(resultMessage, interactionId);
        return resultMessage;
    }

    // Validate channel IDs (basic check)
    const invalidIds = parsedChannelIds.filter(id => !/^\d+$/.test(id));
    if (invalidIds.length > 0) {
        resultMessage = `Invalid channel IDs: ${invalidIds.join(', ')}`;
        sendCommandResult(resultMessage, interactionId);
        return resultMessage;
    }

    // Store user-specific channel list
    setUserChannelList(targetUserId, parsedChannelIds);
    resultMessage = `Successfully set custom channel list for user with ${parsedChannelIds.length} channel(s).`;

    sendCommandResult(resultMessage, interactionId);

    // Send farm status update to keep UI in sync
    const isPermanentFarming = botState.isOwoEnabled && !botState.tempFarmChannel;
    process.send({
        type: 'farm_status_update',
        userId: client.user.id,
        isChannelFarming: !!botState.tempFarmChannel,
        isPermanentFarming,
        channelId: botState.tempFarmChannel,
        tempFarmChannel: botState.tempFarmChannel
    });

    return resultMessage;
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

            // Send farm status update to keep UI in sync
            const isPermanentFarming = botState.isOwoEnabled && !botState.tempFarmChannel;
            process.send({
                type: 'farm_status_update',
                userId: client.user.id,
                isChannelFarming: !!botState.tempFarmChannel,
                isPermanentFarming,
                channelId: botState.tempFarmChannel,
                tempFarmChannel: botState.tempFarmChannel
            });
        }

    } catch (error) {
        Loggers.Bot.error(`Channels command processing error: ${error.message}`);

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
    client.destroy();

    process.exit(0);
}

// Register shutdown handlers
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Additional error handlers for the worker process
process.on('uncaughtException', (error) => {
    Loggers.Bot.error(`Uncaught exception: ${error.message}`);
    stopBot(false);
});

process.on('unhandledRejection', (reason) => {
    Loggers.Bot.error(`Unhandled rejection: ${reason}`);
    stopBot(false);
});

// ============================================================================
// START WORKER
// ============================================================================

initializeWorker();