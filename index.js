const { fork } = require('child_process');
const path = require('path');
const configManager = require('./src/config/manager');
const { Loggers } = require('./src/utils/logger');

async function startApp() {
    try {
        // Konfigürasyonu yükle
        const config = await configManager.loadConfig();
        
        if (!config.tokens || config.tokens.length === 0) {
            console.error('HATA: Hiçbir kullanıcı tokeni (TOKENS) bulunamadı.');
            process.exit(1);
        }

        console.log('--- Selfbot Sistemi Başlatılıyor ---');

        // 1. Notifier (Kontrol Paneli) Sürecini Başlat
        const notifierPath = path.join(__dirname, 'src/process/notifier.js');
        const notifier = fork(notifierPath);
        
        console.log('Notifier bot başlatıldı.');

        // 2. Her Token için Bir Worker Süreci Başlat
        const workers = new Map();
        const workerPath = path.join(__dirname, 'src/process/worker.js');

        config.tokens.forEach((token, index) => {
            const worker = fork(workerPath, [token]);
            workers.set(index, worker);
            
            console.log(`Worker #${index + 1} başlatıldı.`);

            // Worker'dan gelen mesajları Notifier'a ilet
            worker.on('message', (msg) => {
                if (notifier.connected) {
                    notifier.send(msg);
                }
            });

            // Hata yönetimi
            worker.on('exit', (code) => {
                console.error(`Worker #${index + 1} kapandı (Kod: ${code}). Yeniden başlatılıyor...`);
                setTimeout(() => startWorker(token, index, workers, notifier), 5000);
            });
        });

        // Notifier'dan gelen komutları ilgili Worker'lara ilet
        notifier.on('message', (msg) => {
            workers.forEach(worker => {
                if (worker.connected) {
                    worker.send(msg);
                }
            });
        });

    } catch (error) {
        console.error('Sistem başlatılırken kritik hata:', error);
        process.exit(1);
    }
}

function startWorker(token, index, workers, notifier) {
    const workerPath = path.join(__dirname, 'src/process/worker.js');
    const worker = fork(workerPath, [token]);
    workers.set(index, worker);
    
    worker.on('message', (msg) => {
        if (notifier.connected) notifier.send(msg);
    });
    
    worker.on('exit', () => {
        setTimeout(() => startWorker(token, index, workers, notifier), 5000);
    });
}

startApp();