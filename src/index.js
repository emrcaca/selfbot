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
    const userId = null;

    // Create child process with silent output and warnings suppressed
    const childProcess = fork(BOT_SCRIPT, [token], {
        silent: true,
        execArgv: ['--no-warnings']
    });

    // Handle stderr from the child process
    childProcess.stderr.on('data', (data) => {
        const errorMessage = data.toString();
        console.error(`Selfbot (User ID: ${userId || 'Unknown'} - Index: ${index}) stderr: ${errorMessage}`);
    });

    // Handle messages from the child process
    childProcess.on('message', (message) => {
        handleWorkerMessage(childProcess, message, index);
    });

    // Handle child process exit
    childProcess.on('exit', (code, signal) => {
        if (userId) {
            selfbotProcesses.delete(userId);
            console.log(`Selfbot process exited (User ID: ${userId}, Code: ${code}, Signal: ${signal})`);
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

        default:
            console.log(`Unknown message type from worker: ${message.type}`);
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

        if (globalConfig?.enableConsoleLog) {
            console.log(`[MAIN] Selfbot ready notification forwarded (User ID: ${userId})`);
        }
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

    if (globalConfig.enableConsoleLog) {
        console.log('[MAIN] Forwarding CAPTCHA notification to Discord bot...');
    }

    notifierProcess.send(message);

    if (globalConfig.enableConsoleLog) {
        console.log('[MAIN] CAPTCHA notification forwarded');
    }
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
    if (!notifierProcess || !globalConfig) return;

    if (globalConfig.enableConsoleLog) {
        console.log('[MAIN] Forwarding CAPTCHA solved notification to Discord bot...');
    }

    notifierProcess.send(message);

    if (globalConfig.enableConsoleLog) {
        console.log('[MAIN] CAPTCHA solved notification forwarded');
    }
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
        console.error(`Notifier (bot.js) stderr: ${data.toString()}`);
    });

    // Handle notifier process exit
    notifierProcess.on('exit', (code, signal) => {
        console.log(`Notifier process exited (Code: ${code}, Signal: ${signal})`);
        notifierProcess = null;
    });

    return notifierProcess;
}

/**
 * Handles messages received from the notifier process
 * @param {Object} message - Message from the notifier
 */
function handleNotifierMessage(message) {
    if (message.type === 'komut_kullanildi' && message.targetUserId) {
        const targetBot = selfbotProcesses.get(message.targetUserId);

        if (targetBot) {
            targetBot.send(message);
        } else {
            console.log(`[MAIN] Target selfbot not found: ${message.targetUserId}`);
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

        // Log sanitized configuration for debugging
        if (globalConfig.enableConsoleLog) {
            console.log('[MAIN] Configuration loaded:', configManager.getSecureConfig());
        }

        // Validate and filter tokens
        const validTokens = validateTokens(globalConfig.tokens);

        if (validTokens.length === 0) {
            console.warn('[MAIN] No valid tokens found. Exiting...');
            process.exit(0);
            return;
        }

        console.log(`[MAIN] Found ${validTokens.length} valid token(s)`);

        // Start the notifier process if Discord bot token is provided
        if (globalConfig.discordBotToken) {
            console.log('[MAIN] Starting Discord bot (notifier) process...');
            spawnNotifierProcess(globalConfig.discordBotToken);
        } else {
            console.log('[MAIN] Discord bot token not provided, running without notifier');
        }

        // Start all selfbot processes
        console.log('[MAIN] Starting selfbot processes...');
        validTokens.forEach((token, index) => {
            spawnSelfbotProcess(token, index + 1);
        });

        // Display the startup banner
        displayBanner();

        console.log(`[MAIN] Application started with ${validTokens.length} selfbot(s)`);

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
    console.log('[MAIN] Cleaning up...');
    clearAllTrackedTimeouts();

    // Terminate all selfbot processes
    for (const [userId, process] of selfbotProcesses) {
        console.log(`[MAIN] Terminating selfbot process: ${userId}`);
        process.kill();
    }

    // Terminate notifier process
    if (notifierProcess) {
        console.log('[MAIN] Terminating notifier process');
        notifierProcess.kill();
    }
}

// Register cleanup handlers
process.on('exit', cleanup);
process.on('SIGINT', () => {
    console.log('[MAIN] Received SIGINT, shutting down...');
    process.exit(0);
});
process.on('SIGTERM', () => {
    console.log('[MAIN] Received SIGTERM, shutting down...');
    process.exit(0);
});

// ============================================================================
// START APPLICATION
// ============================================================================

// Start the application
initializeApplication();