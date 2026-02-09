const { fork } = require('child_process');
const path = require('path');
const configManager = require('./config/manager');
const { handleUncaughtException, handleUnhandledRejection } = require('./utils/errorHandler');
const { clearAllTrackedTimeouts } = require('./services/discordService');
const { TIMEOUTS } = require('./constants/timeouts');

// Global Error Handlers
process.on('uncaughtException', handleUncaughtException);
process.on('unhandledRejection', handleUnhandledRejection);

class ProcessManager {
    constructor() {
        this.workers = new Map(); // userId -> ChildProcess
        this.notifier = null;
        this.respondedInteractions = new Set();
        this.config = null;
        
        // Paths
        this.WORKER_SCRIPT = path.join(__dirname, 'process', 'worker.js');
        this.NOTIFIER_SCRIPT = path.join(__dirname, 'process', 'notifier.js');
    }

    async start() {
        this._printBanner();
        
        try {
            this.config = await configManager.loadConfig();
            this._logConfig();
            
            await this._startNotifier();
            await this._startWorkers();
            
            this._setupProcessHandlers();
        } catch (error) {
            console.error('❌ Startup Error:', error.message);
            process.exit(1);
        }
    }

    _logConfig() {
        if (this.config.enableConsoleLog) {
            console.log('📋 Configuration loaded:', configManager.getSecureConfig());
        }
    }

    async _startNotifier() {
        if (!this.config.discordBotToken) {
            console.warn('⚠️ No Discord Bot Token provided. Notifier service disabled.');
            return;
        }

        this.notifier = fork(this.NOTIFIER_SCRIPT, [], {
            silent: true,
            execArgv: ['--no-warnings'],
            env: { ...process.env, BOT_TOKEN: this.config.discordBotToken }
        });

        this.notifier.stderr.on('data', (data) => {
            console.error(`[Notifier] Error: ${data.toString()}`);
        });

        this.notifier.on('message', (msg) => this._handleNotifierMessage(msg));
    }

    async _startWorkers() {
        const tokens = this.config.tokens.filter(t => typeof t === 'string' && t.trim());
        
        if (tokens.length === 0) {
            console.error('❌ No user tokens provided!');
            process.exit(1);
        }

        console.log(`🚀 Starting ${tokens.length} worker processes...`);
        
        tokens.forEach((token, index) => {
            this._spawnWorker(token, index + 1);
        });
    }

    _spawnWorker(token, index) {
        const worker = fork(this.WORKER_SCRIPT, [token], {
            silent: true,
            execArgv: ['--no-warnings']
        });

        let workerUserId = null;

        worker.stderr.on('data', (data) => {
            console.error(`[Worker ${index}] Error: ${data.toString()}`);
        });

        worker.on('message', (msg) => {
            if (msg.type === 'selfbot_ready') {
                workerUserId = msg.userId;
                this.workers.set(workerUserId, worker);
                
                // Forward ready status to notifier
                if (this.notifier) {
                    this.notifier.send(msg);
                }
                
                if (this.config.enableConsoleLog) {
                    console.log(`✅ Worker ${index} ready (ID: ${workerUserId})`);
                }
            } else {
                this._handleWorkerMessage(msg);
            }
        });

        worker.on('exit', () => {
            if (workerUserId) {
                this.workers.delete(workerUserId);
                console.log(`⚠️ Worker ${index} (ID: ${workerUserId}) exited.`);
            }
        });
    }

    // --- IPC Routing ---

    /**
     * Route an IPC message to the target worker process
     * @param {string} targetUserId - User ID of the target worker
     * @param {Object} message - Message to send
     * @param {boolean} warnIfNotFound - Whether to log warning if worker not found
     * @returns {boolean} Whether message was sent successfully
     * @private
     */
    _routeToWorker(targetUserId, message, warnIfNotFound = true) {
        const worker = this.workers.get(targetUserId);
        if (worker) {
            worker.send(message);
            return true;
        }

        if (warnIfNotFound) {
            console.warn(`⚠️ Target worker not found for user ${targetUserId}`);
        }
        return false;
    }

    _handleNotifierMessage(msg) {
        // Route message from Notifier -> Worker
        if (msg.type === 'komut_kullanildi' && msg.targetUserId) {
            this._routeToWorker(msg.targetUserId, msg);
        } else if (msg.type === 'channels_command' && msg.targetUserId) {
            this._routeToWorker(msg.targetUserId, msg, false);
        }
    }

    _handleWorkerMessage(msg) {
        // Route message from Worker -> Notifier
        if (!this.notifier) return;

        // Debounce command results
        if (msg.type === 'komut_sonucu') {
            if (!this.respondedInteractions.has(msg.interactionId)) {
                this.respondedInteractions.add(msg.interactionId);
                this.notifier.send(msg);
                
                // Cleanup debounce cache
                setTimeout(() => this.respondedInteractions.delete(msg.interactionId), TIMEOUTS.COMMAND_RESULT_DEBOUNCE);
            }
        } 
        // Forward critical alerts immediately
        else if (['captcha', 'captcha_solved', 'channel_monitor_alert', 'owo_status_update'].includes(msg.type)) {
            this.notifier.send(msg);
            
            if (this.config.enableConsoleLog) {
                console.log(`📨 Routed ${msg.type} from Worker to Notifier`);
            }
        }
    }

    _setupProcessHandlers() {
        process.on('exit', () => {
            clearAllTrackedTimeouts();
            this.workers.forEach(w => w.kill());
            if (this.notifier) this.notifier.kill();
        });
    }

    _printBanner() {
        const width = 45;
        const center = (text) => {
            const padding = Math.max(0, Math.floor((width - text.length) / 2));
            return ' '.repeat(padding) + text + ' '.repeat(width - text.length - padding);
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
    }
}

// Start Application
const manager = new ProcessManager();
manager.start();
