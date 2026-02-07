const { Client } = require('discord.js-selfbot-v13');
const { botState, resumeBot } = require('./modules/core/state');
const { owoLoop, whwbLoop, cycleChannels } = require('./modules/core/farming');
const { handleIncomingMessage, handleCaptchaDM, clearCaptchaState } = require('./modules/handlers/messageHandler');
const { handleUncaughtException, handleUnhandledRejection } = require('./modules/utils/errorHandler');
const { clearAllTrackedTimeouts } = require('./modules/services/discordService');
const { Loggers } = require('./modules/utils/logger');
const { handleFarmCommand } = require('./modules/selfbot/commandHandlers');
const { handleChannelsCommand } = require('./modules/selfbot/channelsHandler');

const token = process.argv[2];
if (!token) {
    process.exit(1);
}

const client = new Client({
    checkUpdate: false,
    ws: { properties: { $browser: "Discord iOS" } }
});

// Set up global error handlers
process.on('uncaughtException', handleUncaughtException);
process.on('unhandledRejection', handleUnhandledRejection);

/**
 * Handle client ready event
 */
client.on('ready', async () => {
    if (process.send) {
        process.send({ type: 'selfbot_ready', userId: client.user.id });
    }

    if (botState.enableConsoleLog) {
        Loggers.Main.info(`Selfbot ${client.user.tag} logged in.`);
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
 * Handle message create event
 */
client.on('messageCreate', async message => {
    await handleIncomingMessage(client, message);
    await handleCaptchaDM(client, message);
});

/**
 * Handle client error
 */
client.on('error', error => {
    Loggers.Main.error('Client error:', error);
});

/**
 * Handle IPC messages from parent process
 */
process.on('message', (msg) => {
    try {
        switch (msg.type) {
            case 'komut_kullanildi':
                handleCommandMessage(msg);
                break;

            case 'channels_command':
                handleChannelsMessage(msg);
                break;

            default:
                // Unknown message type, ignore
                break;
        }
    } catch (error) {
        Loggers.Main.error('Command processing error:', error);
        sendErrorResponse(msg, 'Komut işlenirken hata oluştu.');
    }
});

/**
 * Handle command messages
 * @param {Object} msg - Message object
 */
function handleCommandMessage(msg) {
    const resultMessage = handleFarmCommand(msg);

    if (process.send) {
        process.send({
            type: 'komut_sonucu',
            resultMessage,
            interactionId: msg.interactionId,
            isOwoEnabled: botState.isOwoEnabled
        });
    }
}

/**
 * Handle channels command messages
 * @param {Object} msg - Message object
 */
function handleChannelsMessage(msg) {
    const resultMessage = handleChannelsCommand(msg);

    if (process.send) {
        process.send({
            type: 'komut_sonucu',
            resultMessage,
            interactionId: msg.interactionId
        });
    }
}

/**
 * Send error response
 * @param {Object} msg - Original message
 * @param {string} errorMessage - Error message
 */
function sendErrorResponse(msg, errorMessage) {
    if (process.send) {
        process.send({
            type: 'komut_sonucu',
            resultMessage: errorMessage,
            interactionId: msg.interactionId
        });
    }
}

/**
 * Shutdown the selfbot
 */
async function shutdown() {
    const { stopBot } = require('./modules/core/state');
    stopBot(false);
    await clearCaptchaState("Shutdown");
    clearAllTrackedTimeouts();
    client.destroy();
    process.exit(0);
}

/**
 * Handle uncaught exception in selfbot
 */
process.on('uncaughtException', (error) => {
    Loggers.Main.error('Uncaught exception in selfbot:', error);
    const { stopBot } = require('./modules/core/state');
    stopBot(false);
});

/**
 * Handle unhandled rejection in selfbot
 */
process.on('unhandledRejection', (reason) => {
    Loggers.Main.error('Unhandled rejection in selfbot:', reason);
    const { stopBot } = require('./modules/core/state');
    stopBot(false);
});

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Login to Discord
client.login(token).catch(err => {
    Loggers.Main.error('Login error:', err);
    process.exit(1);
});