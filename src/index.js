/**
 * Selfbot Main Entry Point
 *
 * This is the main entry point for the Discord selfbot application.
 * It manages multiple selfbot processes and coordinates communication
 * between them and the Discord bot (notifier) process.
 *
 * @module index
 */

const { fork } = require('child_process');
const path = require('path');
const configManager = require('./config/manager');
const { handleUncaughtException, handleUnhandledRejection } = require('./utils/errorHandler');
const { clearAllTrackedTimeouts } = require('./services/discordService');
const { Loggers } = require('./utils/logger');
const { initializeConfig } = require('./core/state');

// ============================================================================
// CONSTANTS
// ============================================================================

/** Path to the selfbot worker script */
const BOT_SCRIPT = path.join(__dirname, 'process', 'worker.js');

/** Path to the Discord bot (notifier) script */
const NOTIFIER_SCRIPT = path.join(__dirname, 'process', 'notifier.js');

/** Width of the ASCII art banner */
const BANNER_WIDTH = 45;

/** Duration to keep interaction responses tracked (ms) */
const INTERACTION_TRACK_DURATION = 20000;

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/** Map of active selfbot processes keyed by user ID */
const selfbotProcesses = new Map();

/** Reference to the notifier (Discord bot) process */
let notifierProcess = null;

/** Set of interaction IDs that have been responded to, to prevent duplicates */
const respondedInteractions = new Set();

/** Global configuration object */
let globalConfig = null;

// ============================================================================
// ERROR HANDLING
// ============================================================================

// Set up global error handlers for the main process
process.on('uncaughtException', handleUncaughtException);
process.on('unhandledRejection', handleUnhandledRejection);

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Centers text within the banner width
 * @param {string} text - Text to center
 * @returns {string} Centered text with padding
 */
function centerText(text) {
    const textLength = text.length;
    const padding = Math.max(0, Math.floor((BANNER_WIDTH - textLength) / 2));
    return ' '.repeat(padding) + text + ' '.repeat(BANNER_WIDTH - textLength - padding);
}

/**
 * Generates and displays the startup banner
 */
function displayBanner() {
    console.log(`
╔${'─'.repeat(BANNER_WIDTH)}╗
│${' '.repeat(BANNER_WIDTH)}│
│${centerText('███████╗███╗   ███╗██████╗')}│
│${centerText('██╔════╝████╗ ████║██╔══██╗')}│
│${centerText('█████╗  ██╔████╔██║██████╔╝')}│
│${centerText('██╔══╝  ██║╚██╔╝██║██╔══██╗')}│
│${centerText('███████╗██║ ╚═╝ ██║██║  ██║')}│
│${centerText('╚══════╝╚═╝     ╚═╝╚═╝  ╚═╝')}│
│${' '.repeat(BANNER_WIDTH)}│
│${centerText('*** SYSTEM ACTIVE ***')}│
│${' '.repeat(BANNER_WIDTH)}│
╚${'─'.repeat(BANNER_WIDTH)}╝
╔${'─'.repeat(BANNER_WIDTH)}╗
│${' '.repeat(BANNER_WIDTH)}│
│${'\x1b[94m'}${centerText('*** emrcaca ***')}${'\x1b[0m'}│
│${' '.repeat(BANNER_WIDTH)}│
╚${'─'.repeat(BANNER_WIDTH)}╝
`);
}

// ============================================================================
// SELFBOT PROCESS MANAGEMENT
// ============================================================================

/**
 * Creates and manages a selfbot worker process
 * @param {string} token - Discord user token for the selfbot
 * @param {number} index - Index of the selfbot (for logging)
 */
function spawnSelfbotProcess(token, index) {
    // Create child process with silent output and warnings suppressed
    const childProcess = fork(BOT_SCRIPT, [token], {
        silent: true,
        execArgv: ['--no-warnings']
    });

    // Handle stderr from the child process
    childProcess.stderr.on('data', (data) => {
        Loggers.Main.error(`Selfbot (Index: ${index}) stderr: ${data.toString()}`);
    });

    // Handle messages from the child process
    childProcess.on('message', (message) => {
        handleWorkerMessage(childProcess, message, index);
    });

    // Handle child process exit
    childProcess.on('exit', (code, signal) => {
        // Find and remove the userId entry from the map
        let foundUserId = null;
        for (const [uid, proc] of selfbotProcesses.entries()) {
            if (proc === childProcess || proc?.pid === childProcess.pid) {
                foundUserId = uid;
                break;
            }
        }
        if (foundUserId) {
            selfbotProcesses.delete(foundUserId);
            Loggers.Main.info(`Selfbot process exited (User ID: ${foundUserId}, Index: ${index}, Code: ${code}, Signal: ${signal})`);
        } else {
            Loggers.Main.info(`Selfbot process exited (Index: ${index}, Code: ${code}, Signal: ${signal})`);
        }
    });

    return childProcess;
}

/**
 * Handles messages received from a worker process
 * @param {ChildProcess} childProcess - The worker process instance
 * @param {Object} message - The message object from the worker
 * @param {number} index - Index of the worker (for logging)
 */
function handleWorkerMessage(childProcess, message, index) {
    switch (message.type) {
        case 'selfbot_ready':
            handleSelfbotReady(childProcess, message);
            break;

        case 'komut_sonucu':
            handleCommandResult(message);
            break;

        case 'captcha':
            handleCaptchaNotification(message);
            break;

        case 'channel_monitor_alert':
            handleChannelMonitorAlert(message);
            break;

        case 'captcha_solved':
            handleCaptchaSolved(message);
            break;

        case 'owo_status_update':
            handleOwoStatusUpdate(message);
            break;

        default:
            Loggers.Main.debug(`Unknown message type from worker: ${message.type}`);
    }
}

/**
 * Handles the selfbot_ready message from a worker
 * @param {ChildProcess} childProcess - The worker process instance
 * @param {Object} message - Message containing user ID
 */
function handleSelfbotReady(childProcess, message) {
    const { userId } = message;

    // Store the process reference
    selfbotProcesses.set(userId, childProcess);

    // Notify the Discord bot if it's running
    if (notifierProcess) {
        notifierProcess.send(message);

        Loggers.Main.info(`Selfbot ready notification forwarded (User ID: ${userId})`);
    }
}

/**
 * Handles command result messages from workers
 * @param {Object} message - Command result message
 */
function handleCommandResult(message) {
    if (!notifierProcess) return;

    const { interactionId } = message;

    // Prevent duplicate responses
    if (!respondedInteractions.has(interactionId)) {
        respondedInteractions.add(interactionId);
        notifierProcess.send(message);

        // Clean up after the tracking duration
        setTimeout(() => {
            respondedInteractions.delete(interactionId);
        }, INTERACTION_TRACK_DURATION);
    }
}

/**
 * Handles CAPTCHA notification messages from workers
 * @param {Object} message - CAPTCHA notification message
 */
function handleCaptchaNotification(message) {
    if (!notifierProcess || !globalConfig) return;

    Loggers.Main.info('Forwarding CAPTCHA notification to Discord bot...');
    notifierProcess.send(message);
    Loggers.Main.info('CAPTCHA notification forwarded');
}

/**
 * Handles channel monitor alert messages from workers
 * @param {Object} message - Channel monitor alert message
 */
function handleChannelMonitorAlert(message) {
    if (!notifierProcess) return;
    notifierProcess.send(message);
}

/**
 * Handles CAPTCHA solved messages from workers
 * @param {Object} message - CAPTCHA solved message
 */
function handleCaptchaSolved(message) {
    if (!notifierProcess) return;

    Loggers.Main.info('Forwarding CAPTCHA solved notification to Discord bot...');
    notifierProcess.send(message);
    Loggers.Main.info('CAPTCHA solved notification forwarded');
}

/**
 * Handles OWO status update messages from workers
 * @param {Object} message - OWO status update message
 */
function handleOwoStatusUpdate(message) {
    if (!notifierProcess) return;

    // Forward to notifier process to update button states
    notifierProcess.send(message);
}

// ============================================================================
// NOTIFIER PROCESS MANAGEMENT
// ============================================================================

/**
 * Creates and manages the Discord bot (notifier) process
 * @param {string} botToken - Discord bot token
 */
function spawnNotifierProcess(botToken) {
    notifierProcess = fork(NOTIFIER_SCRIPT, [], {
        silent: true,
        execArgv: ['--no-warnings'],
        env: { ...process.env, BOT_TOKEN: botToken }
    });

    // Handle messages from the notifier
    notifierProcess.on('message', (message) => {
        handleNotifierMessage(message);
    });

    // Handle stderr from the notifier
    notifierProcess.stderr.on('data', (data) => {
        Loggers.Main.error(`Notifier (bot.js) stderr: ${data.toString()}`);
    });

    // Handle notifier process exit
    notifierProcess.on('exit', (code, signal) => {
        Loggers.Main.info(`Notifier process exited (Code: ${code}, Signal: ${signal})`);
        notifierProcess = null;
    });

    return notifierProcess;
}

/**
 * Handles messages received from the notifier process
 * @param {Object} message - Message from the notifier
 */
function handleNotifierMessage(message) {
    const forwardableTypes = ['komut_kullanildi', 'setch_command', 'channels_command', 'emoji_monitoring_command'];
    if (forwardableTypes.includes(message.type) && message.targetUserId) {
        const targetBot = selfbotProcesses.get(message.targetUserId);

        if (targetBot) {
            targetBot.send(message);
        } else {
            Loggers.Main.info(`Target selfbot not found: ${message.targetUserId}`);
        }
    }
}

// ============================================================================
// APPLICATION INITIALIZATION
// ============================================================================

/**
 * Validates and filters tokens
 * @param {string[]} tokens - Array of tokens to validate
 * @returns {string[]} Array of valid, non-empty tokens
 */
function validateTokens(tokens) {
    return tokens.filter(token => {
        return typeof token === 'string' && token.trim().length > 0;
    });
}

/**
 * Initializes the application
 */
async function initializeApplication() {
    try {
        // Load configuration
        console.log('[MAIN] Loading configuration...');
        globalConfig = await configManager.loadConfig();

        // Initialize bot state for logger
        initializeConfig(globalConfig);

        // Log sanitized configuration for debugging
        Loggers.Main.info('Configuration loaded:', configManager.getSecureConfig());

        // Validate and filter tokens
        const validTokens = validateTokens(globalConfig.tokens);

        if (validTokens.length === 0) {
            console.warn('[MAIN] No valid tokens found. Exiting...');
            process.exit(0);
            return;
        }

        Loggers.Main.info(`Found ${validTokens.length} valid token(s)`);

        // Start the notifier process if Discord bot token is provided
        if (globalConfig.discordBotToken) {
            Loggers.Main.info('Starting Discord bot (notifier) process...');
            spawnNotifierProcess(globalConfig.discordBotToken);
        } else {
            Loggers.Main.info('Discord bot token not provided, running without notifier');
        }

        // Start all selfbot processes
        Loggers.Main.info('Starting selfbot processes...');
        validTokens.forEach((token, index) => {
            spawnSelfbotProcess(token, index + 1);
        });

        // Display the startup banner
        displayBanner();

        Loggers.Main.info(`Application started with ${validTokens.length} selfbot(s)`);

    } catch (error) {
        console.error('[MAIN] Failed to initialize application:', error.message);
        console.error('[MAIN] Please check your .env file and environment variables');
        process.exit(1);
    }
}

// ============================================================================
// CLEANUP AND SHUTDOWN
// ============================================================================

/**
 * Cleanup function called on process exit
 */
function cleanup() {
    Loggers.Main.info('Cleaning up...');
    clearAllTrackedTimeouts();

    // Terminate all selfbot processes
    for (const [userId, process] of selfbotProcesses) {
        Loggers.Main.info(`Terminating selfbot process: ${userId}`);
        process.kill();
    }

    // Terminate notifier process
    if (notifierProcess) {
        Loggers.Main.info('Terminating notifier process');
        notifierProcess.kill();
    }
}

// Register cleanup handlers
process.on('exit', cleanup);
process.on('SIGINT', () => {
    Loggers.Main.info('Received SIGINT, shutting down...');
    process.exit(0);
});
process.on('SIGTERM', () => {
    Loggers.Main.info('Received SIGTERM, shutting down...');
    process.exit(0);
});

// ============================================================================
// START APPLICATION
// ============================================================================

// Start the application
initializeApplication();