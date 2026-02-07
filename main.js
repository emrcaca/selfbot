const { fork } = require('child_process');
const path = require('path');
const configManager = require('./modules/config/configManager');
const { handleUncaughtException, handleUnhandledRejection } = require('./modules/utils/errorHandler');
const { clearAllTrackedTimeouts } = require('./modules/services/discordService');
const { initLogger, Loggers } = require('./modules/utils/logger');

// Set up global error handlers
process.on('uncaughtException', handleUncaughtException);
process.on('unhandledRejection', handleUnhandledRejection);

const BOT_SCRIPT = path.join(__dirname, 'selfbot.js');
const NOTIFIER_SCRIPT = path.join(__dirname, 'bot.js');

const CONFIG_WIDTH = 45;
const RESPONSE_TIMEOUT = 20000;

const state = {
    selfbotProcesses: new Map(),
    notifierProcess: null,
    respondedInteractions: new Set(),
    globalConfig: null
};

/**
 * Print centered text within a box
 * @param {string} text - Text to center
 * @returns {string} Centered text with padding
 */
const centerText = (text) => {
    const textLength = text.length;
    const padding = Math.max(0, Math.floor((CONFIG_WIDTH - textLength) / 2));
    return ' '.repeat(padding) + text + ' '.repeat(CONFIG_WIDTH - textLength - padding);
};

/**
 * Display ASCII art banner
 */
const displayBanner = () => {
    console.log(`
╔${'─'.repeat(CONFIG_WIDTH)}╗
│${' '.repeat(CONFIG_WIDTH)}│
│${centerText('███████╗███╗   ███╗██████╗')}│
│${centerText('██╔════╝████╗ ████║██╔══██╗')}│
│${centerText('█████╗  ██╔████╔██║██████╔╝')}│
│${centerText('██╔══╝  ██║╚██╔╝██║██╔══██╗')}│
│${centerText('███████╗██║ ╚═╝ ██║██║  ██║')}│
│${centerText('╚══════╝╚═╝     ╚═╝╚═╝  ╚═╝')}│
│${' '.repeat(CONFIG_WIDTH)}│
│${centerText('*** SISTEM AKTIF ***')}│
│${' '.repeat(CONFIG_WIDTH)}│
╚${'─'.repeat(CONFIG_WIDTH)}╝
╔${'─'.repeat(CONFIG_WIDTH)}╗
│${' '.repeat(CONFIG_WIDTH)}│
│${'\x1b[94m'}${centerText('*** emrxxxx ***')}${'\x1b[0m'}│
│${' '.repeat(CONFIG_WIDTH)}│
╚${'─'.repeat(CONFIG_WIDTH)}╝
`);
};

/**
 * Forward message to notifier if available
 * @param {Object} msg - Message to forward
 */
const forwardToNotifier = (msg) => {
    if (state.notifierProcess) {
        state.notifierProcess.send(msg);
    }
};

/**
 * Handle selfbot process messages
 * @param {Object} child - Child process
 * @param {number} index - Bot index
 * @param {string|null} userId - User ID (set when ready)
 */
const handleBotMessage = (child, index, userId) => async (msg) => {
    switch (msg.type) {
        case 'selfbot_ready':
            state.selfbotProcesses.set(msg.userId, child);
            userId = msg.userId;
            if (state.globalConfig.enableConsoleLog) {
                Loggers.Main.info(`Selfbot ready (User ID: ${msg.userId})`);
            }
            forwardToNotifier(msg);
            break;

        case 'komut_sonucu':
            if (!state.respondedInteractions.has(msg.interactionId)) {
                state.respondedInteractions.add(msg.interactionId);
                forwardToNotifier(msg);
                setTimeout(() => state.respondedInteractions.delete(msg.interactionId), RESPONSE_TIMEOUT);
            }
            break;

        case 'captcha':
        case 'channel_monitor_alert':
        case 'captcha_solved':
            forwardToNotifier(msg);
            break;

        default:
            // Unknown message type, ignore
            break;
    }
};

/**
 * Spawn a selfbot process
 * @param {string} token - Discord token
 * @param {number} index - Bot index
 */
const spawnBot = (token, index) => {
    const child = fork(BOT_SCRIPT, [token], { silent: true });
    let userId = null;

    child.stderr.on('data', (data) => {
        console.error(`Selfbot (Index: ${index}) stderr: ${data.toString()}`);
    });

    child.on('message', handleBotMessage(child, index, userId));

    child.on('exit', (code, signal) => {
        if (userId) {
            state.selfbotProcesses.delete(userId);
            Loggers.Main.info(`Selfbot (User ID: ${userId}) exited (code: ${code}, signal: ${signal})`);
        }
    });
};

/**
 * Spawn notifier process
 * @returns {void}
 */
const spawnNotifier = () => {
    if (!state.globalConfig.discordBotToken) {
        return;
    }

    state.notifierProcess = fork(NOTIFIER_SCRIPT, [], {
        silent: true,
        env: { ...process.env, BOT_TOKEN: state.globalConfig.discordBotToken }
    });

    state.notifierProcess.on('message', (msg) => {
        if (msg.type === 'komut_kullanildi' && msg.targetUserId) {
            const targetBot = state.selfbotProcesses.get(msg.targetUserId);
            if (targetBot) {
                targetBot.send(msg);
            }
        }
    });

    state.notifierProcess.stderr.on('data', (data) => {
        console.error(`Notifier (bot.js) stderr: ${data.toString()}`);
    });
};

/**
 * Validate and extract tokens
 * @param {Array} tokens - Array of tokens from config
 * @returns {Array} Valid tokens
 */
const validateTokens = (tokens) => {
    return tokens.filter(token => typeof token === 'string' && token.trim());
};

/**
 * Main initialization
 * @returns {Promise<void>}
 */
const initialize = async () => {
    try {
        // Load configuration using ConfigManager
        const config = await configManager.loadConfig();
        state.globalConfig = config;

        // Initialize logger with config
        initLogger(config);

        // Log sanitized config for debugging
        if (config.enableConsoleLog) {
            Loggers.Main.info('Configuration loaded:', configManager.getSecureConfig());
        }

        const tokens = validateTokens(config.tokens);

        if (tokens.length === 0) {
            Loggers.Main.error('No valid tokens found in configuration');
            process.exit(0);
        }

        // Spawn notifier process
        spawnNotifier();

        // Spawn selfbot processes
        tokens.forEach((token, index) => spawnBot(token, index + 1));

        // Display banner
        displayBanner();

    } catch (error) {
        Loggers.Main.error('Failed to initialize:', error.message);
        Loggers.Main.error('💡 Please check your .env file');
        process.exit(1);
    }
};

// Start the application
initialize().catch(error => {
    console.error('Fatal error during initialization:', error);
    process.exit(1);
});

// Clear all tracked timeouts on exit
process.on('exit', () => {
    clearAllTrackedTimeouts();
});