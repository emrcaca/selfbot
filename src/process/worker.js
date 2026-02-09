const { Client } = require('discord.js-selfbot-v13');
const configManager = require('../config/manager');
const { botState, resumeBot, initializeConfig } = require('../core/state');
const { owoLoop, whwbLoop, cycleChannels } = require('../core/farming');
const { handleIncomingMessage, handleCaptchaDM, clearCaptchaState } = require('../handlers/messageHandler');
const { handleUncaughtException, handleUnhandledRejection } = require('../utils/errorHandler');
const { clearAllTrackedTimeouts } = require('../services/discordService');
const IPCHandler = require('./ipcHandler');
const { Loggers } = require('../utils/logger');
const IPCMessageBuilder = require('../utils/ipcMessageBuilder');

// Security: Fix for self-signed certificate error (common in some proxy setups)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Global Error Handlers
process.on('uncaughtException', handleUncaughtException);
process.on('unhandledRejection', handleUnhandledRejection);

// Validate Arguments
const token = process.argv[2];
if (!token) {
    console.error('❌ No token provided to worker process');
    process.exit(1);
}

// Initialize Client
const client = new Client({
    checkUpdate: false,
    ws: { properties: { $browser: "Discord iOS" } }
});

// Initialize IPC Handler
const ipcHandler = new IPCHandler(client);

// Helper: Graceful Shutdown
async function shutdown(signal) {
    Loggers.Farm.info(`Received ${signal}, shutting down...`);
    
    // Stop operations
    if (botState.isRunning) {
        botState.isRunning = false;
    }
    
    await clearCaptchaState("Shutdown");
    clearAllTrackedTimeouts();
    
    // Destroy client
    client.destroy();
    process.exit(0);
}

// Signal Handlers
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// IPC Message Listener
process.on('message', async (msg) => {
    if (!msg || !msg.type) return;
    await ipcHandler.handleMessage(msg); // Use the new handler class
});

// Client Event: Ready
client.on('ready', async () => {
    // Notify Main Process
    if (process.send) {
        process.send(IPCMessageBuilder.buildSelfbotReady(client.user.id));
    }

    if (botState.enableConsoleLog) {
        console.log(`[READY] Selfbot ${client.user.tag} active.`);
    }

    // Start Loops (they check state internally)
    owoLoop(client);
    whwbLoop(client);
    cycleChannels(client);

    // Auto-resume if safe
    if (!botState.captchaDetected) {
        resumeBot();
    }
});

// Client Event: Message Create
client.on('messageCreate', async (message) => {
    await handleIncomingMessage(client, message);
    await handleCaptchaDM(client, message);
});

// Client Event: Error
client.on('error', (error) => {
    Loggers.Farm.error(`Client Error: ${error.message}`);
});

// Main Initialization
(async () => {
    try {
        const config = await configManager.loadConfig();
        initializeConfig(config);
        
        await client.login(token);
    } catch (error) {
        console.error('❌ Failed to start worker:', error.message);
        process.exit(1);
    }
})();
