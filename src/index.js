const { fork } = require('child_process');
const path = require('path');
const configManager = require('./config/manager');
const { handleUncaughtException, handleUnhandledRejection } = require('./utils/errorHandler');
const { clearAllTrackedTimeouts } = require('./services/discordService');

// Set up global error handlers
process.on('uncaughtException', handleUncaughtException);
process.on('unhandledRejection', handleUnhandledRejection);

const BOT_SCRIPT = path.join(__dirname, 'process', 'worker.js');
const NOTIFIER_SCRIPT = path.join(__dirname, 'process', 'notifier.js');

const selfbotProcesses = new Map();
let notifierProcess;
const respondedInteractions = new Set();
let globalConfig;

function spawnBot(token, index) {
    // Suppress warnings in child processes
    const child = fork(BOT_SCRIPT, [token], { 
        silent: true,
        execArgv: ['--no-warnings']
    });
    let userId = null;

    child.stderr.on('data', (data) => {
        console.error(`Selfbot (User ID: ${userId || 'Unknown'} - Index: ${index}) stderr: ${data.toString()}`);
    });

    child.on('message', async (msg) => {
        if (msg.type === 'selfbot_ready') {
            userId = msg.userId;
            selfbotProcesses.set(userId, child);
            if (notifierProcess) {
                notifierProcess.send(msg);
                if (globalConfig.enableConsoleLog) {
                    console.log(`✅ Main.js: selfbot_ready mesajı bot.js'ye iletildi (User ID: ${userId})`);
                }
            }
        } else if (notifierProcess && msg.type === 'komut_sonucu') {
            if (!respondedInteractions.has(msg.interactionId)) {
                respondedInteractions.add(msg.interactionId);
                notifierProcess.send(msg);
                setTimeout(() => respondedInteractions.delete(msg.interactionId), 20000);
            }
        } else if (notifierProcess && msg.type === 'captcha') {
            if (globalConfig.enableConsoleLog) {
                console.log('📤 Main.js: CAPTCHA mesajı bot.js\'e iletilir...');
            }
            notifierProcess.send(msg);
            if (globalConfig.enableConsoleLog) {
                console.log('✅ Main.js: CAPTCHA mesajı bot.js\'e iletildi');
            }
        } else if (notifierProcess && msg.type === 'channel_monitor_alert') {
            notifierProcess.send(msg);
        } else if (notifierProcess && msg.type === 'captcha_solved') {
            if (globalConfig.enableConsoleLog) {
                console.log('📤 Main.js: captcha_solved mesajı bot.js\'e iletiliyor...');
            }
            notifierProcess.send(msg);
            if (globalConfig.enableConsoleLog) {
                console.log('✅ Main.js: captcha_solved mesajı bot.js\'e iletildi');
            }
        } else {
        }
    });

    child.on('exit', (code, signal) => {
        if (userId) {
            selfbotProcesses.delete(userId);
        }
    });
}

(async () => {
    try {
        // Load configuration using ConfigManager
        const config = await configManager.loadConfig();
        globalConfig = config;

        // Log sanitized config for debugging
        if (globalConfig.enableConsoleLog) {
            console.log('📋 Configuration loaded:', configManager.getSecureConfig());
        }
    } catch (error) {
        console.error('❌ Failed to load configuration:', error.message);
        console.error('💡 Please check your config.json or environment variables');
        process.exit(1);
    }

    const tokens = globalConfig.tokens.filter(token => typeof token === 'string' && token.trim());

    if (!tokens.length) {
        process.exit(0);
    }

    if (globalConfig.discordBotToken) {
        notifierProcess = fork(NOTIFIER_SCRIPT, [], {
            silent: true,
            execArgv: ['--no-warnings'],
            env: { ...process.env, BOT_TOKEN: globalConfig.discordBotToken }
        });

        notifierProcess.on('message', (msg) => {
            if (msg.type === 'komut_kullanildi' && msg.targetUserId) {
                const targetBot = selfbotProcesses.get(msg.targetUserId);
                if (targetBot) {
                    targetBot.send(msg);
                } else {
                }
            }
        });


        notifierProcess.stderr.on('data', (data) => {
            console.error(`Notifier (bot.js) stderr: ${data.toString()}`);
        });
    } else {
    }

    tokens.forEach((token, index) => spawnBot(token, index + 1));
const width = 45;
const center = (text) => {
    const textLength = text.length;
    const padding = Math.max(0, Math.floor((width - textLength) / 2));
    return ' '.repeat(padding) + text + ' '.repeat(width - textLength - padding);
};

console.log(`
╔${'─'.repeat(width)}╗
│${' '.repeat(width)}│
│${center('███████╗███╗   ███╗██████╗')}│
│${center('██╔════╝████╗ ████║██╔══██╗')}│
│${center('█████╗  ██╔████╔██║██████╔╝')}│
│${center('██╔══╝  ██║╚██╔╝██║██╔══██╗')}│
│${center('███████╗██║ ╚═╝ ██║██║  ██║')}│
│${center('╚══════╝╚═╝     ╚═╝╚═╝  ╚═╝')}│
│${' '.repeat(width)}│
│${center('*** SISTEM AKTIF ***')}│
│${' '.repeat(width)}│
╚${'─'.repeat(width)}╝
╔${'─'.repeat(width)}╗
│${' '.repeat(width)}│
│${'\x1b[94m'}${center('*** emrcaca ***')}${'\x1b[0m'}│
│${' '.repeat(width)}│
╚${'─'.repeat(width)}╝
`);
})();

// Clear all tracked timeouts on exit
process.on('exit', () => {
    clearAllTrackedTimeouts();
});