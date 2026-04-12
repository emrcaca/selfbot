const { Client } = require('discord.js-selfbot-v13');
const configManager = require('../config/manager');
const { botState, resumeBot, stopBot, toggleBooleanState, initializeConfig } = require('../core/state');
const { owoLoop, whwbLoop, cycleChannels } = require('../core/farming');
const { handleIncomingMessage, handleCaptchaDM, clearCaptchaState } = require('../handlers/messageHandler');
const { handleUncaughtException, handleUnhandledRejection } = require('../utils/errorHandler');
const { clearAllTrackedTimeouts } = require('../services/discordService');

// Fix for self-signed certificate error
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Set up global error handlers
process.on('uncaughtException', handleUncaughtException);
process.on('unhandledRejection', handleUnhandledRejection);

const token = process.argv[2];
if (!token) {
    process.exit(1);
}

// Initialize client
const client = new Client({
    checkUpdate: false,
    ws: { properties: { $browser: "Discord iOS" } }
});

// Load configuration and start client
(async () => {
    try {
        // Load configuration first
        const config = await configManager.loadConfig();
        initializeConfig(config);
        
        // Then login
        await client.login(token);
    } catch (error) {
        console.error('❌ Failed to start selfbot:', error.message);
        process.exit(1);
    }
})();

client.on('ready', async () => {
    if (process.send) {
        process.send({ type: 'selfbot_ready', userId: client.user.id });
    }

    // Konsol log ayarına göre ASCII hariç log yazdırma
    if (botState.enableConsoleLog) {
        console.log(`[READY] Selfbot ${client.user.tag} olarak giriş yaptı.`);
    }

    owoLoop(client);
    whwbLoop(client);
    cycleChannels(client);

    if (!botState.captchaDetected) {
        if(resumeBot()) {
        }
    }
});

client.on('messageCreate', async message => {
    await handleIncomingMessage(client, message);
    await handleCaptchaDM(client, message);
});

client.on('error', error => {
    console.error('Client error:', error);
});

process.on('message', (msg) => {
    if (msg.type === 'komut_kullanildi') {
        try {
            let resultMessage = '';
            const TEN_MINUTES_MS = 10 * 60 * 1000;

            switch (msg.command) {
            case 'farm':
                const TEN_MINUTES_MS = 10 * 60 * 1000;
                const farmType = msg.farmType;
                const interactionChannelId = msg.channelId;

                if (farmType === 'this_channel') { // Specific channel farming
                    const channelId = interactionChannelId;
                    if (!botState.timedChannels[channelId]) {
                        botState.timedChannels[channelId] = { elapsed: 0 };
                    }
                    const channelTimer = botState.timedChannels[channelId];

                    if (channelTimer.elapsed >= TEN_MINUTES_MS) {
                        resultMessage = "Bu kanalda 10 dakika oynadınız, lütfen başka bir kanala geçin.";
                        break;
                    }

                    if (botState.activeTimedFarm.channelId && botState.activeTimedFarm.channelId !== channelId) {
                        clearTimeout(botState.activeTimedFarm.timeoutId);
                        const oldChannelId = botState.activeTimedFarm.channelId;
                        
                        if (botState.timedChannels[oldChannelId] && botState.activeTimedFarm.startTime) {
                            const elapsedThisSession = Date.now() - botState.activeTimedFarm.startTime;
                            botState.timedChannels[oldChannelId].elapsed += elapsedThisSession;
                            
                            if (botState.timedChannels[oldChannelId].elapsed >= TEN_MINUTES_MS) {
                                botState.timedChannels[oldChannelId].elapsed = 0;
                            }
                        }
                        
                        botState.activeTimedFarm = { channelId: null, startTime: null, timeoutId: null };
                    }

                    const isStarting = !botState.isOwoEnabled || botState.activeTimedFarm.channelId !== channelId;
                    botState.isOwoEnabled = isStarting;

                    if (isStarting) {
                        try {
                            for (const [chanId, timer] of Object.entries(botState.timedChannels)) {
                                if (timer && typeof timer.elapsed === 'number' && timer.elapsed >= TEN_MINUTES_MS) {
                                    botState.timedChannels[chanId].elapsed = 0;
                                }
                            }
                        } catch (e) {}
                        const remainingTime = TEN_MINUTES_MS - channelTimer.elapsed;
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
                        botState.tempFarmChannel = channelId;
                        resumeBot();
                        resultMessage = `Farm bu kanalda başlatıldı. Kalan süre: ${Math.round(remainingTime / 60000)} dakika.`;
                    } else {
                        if (botState.activeTimedFarm.timeoutId) {
                            clearTimeout(botState.activeTimedFarm.timeoutId);
                        }
                        const startTime = botState.activeTimedFarm.startTime;
                        if (startTime) {
                            channelTimer.elapsed += (Date.now() - startTime);
                        }
                        botState.activeTimedFarm = { channelId: null, startTime: null, timeoutId: null };
                        botState.tempFarmChannel = null;
                        stopBot();
                        botState.isOwoEnabled = false;
                        resultMessage = 'Farm duraklatıldı.';
                    }
                } else if (farmType === 'permanent_channels') { // Permanent channel farming
                    if (botState.channelIds.length > 0) {
                        toggleBooleanState('isOwoEnabled', 'Owo Farm');
                        if (botState.isOwoEnabled) {
                            resumeBot();
                            resultMessage = 'Kalıcı listedeki kanallar için farm etkinleştirildi. Kısa süre içinde başlayacaktır.';
                        } else {
                            stopBot();
                            resultMessage = 'Farm devre dışı bırakıldı.';
                        }
                    } else {
                        resultMessage = 'Farm yapmak için kalıcı kanal listesi boş veya belirli bir kanal belirtilmedi.';
                    }
                }
                break;
            }

            if (process.send) {
                process.send({
                    type: 'komut_sonucu',
                    resultMessage,
                    interactionId: msg.interactionId,
                    isOwoEnabled: botState.isOwoEnabled
                });
            }
        } catch (error) { // Hata işleme bloğu
                    console.error('❌ Command processing error:', error);
            if (process.send) {
                process.send({
                    type: 'komut_sonucu',
                    resultMessage: 'Komut işlenirken hata oluştu.',
                    interactionId: msg.interactionId
                });
            }
        }
    } else if (msg.type === 'channels_command') {
        try {
            let resultMessage = '';
            
            if (msg.action === 'add') {
                if (!msg.channelIds) {
                    resultMessage = 'Kanal ID\'leri belirtilmelidir.';
                } else {
                    // Parse and validate channel IDs
                    const channelIds = msg.channelIds.split(',').map(id => id.trim()).filter(id => id.length > 0);
                    const validChannelIds = [];
                    const invalidChannelIds = [];
                    
                    for (const id of channelIds) {
                        // Check if ID is numeric
                        if (/^\d+$/.test(id)) {
                            validChannelIds.push(id);
                        } else {
                            invalidChannelIds.push(id);
                        }
                    }
                    
                    if (invalidChannelIds.length > 0) {
                        resultMessage = `Geçersiz kanal ID'leri: ${invalidChannelIds.join(', ')}. Sadece sayısal değerler kabul edilir.`;
                    } else {
                        // Add valid channel IDs to the list
                        botState.channelIds = [...new Set([...botState.channelIds, ...validChannelIds])];
                        resultMessage = `${validChannelIds.length} kanal başarıyla eklendi. Toplam kanal sayısı: ${botState.channelIds.length}`;
                    }
                }
            } else if (msg.action === 'clear') {
                botState.channelIds = [];
                resultMessage = 'Kalıcı kanal listesi başarıyla temizlendi.';
            } else {
                resultMessage = 'Geçersiz işlem.';
            }
            
            if (process.send) {
                process.send({
                    type: 'komut_sonucu',
                    resultMessage,
                    interactionId: msg.interactionId
                });
            }
        } catch (error) {
            console.error('❌ Channels command processing error:', error);
            if (process.send) {
                process.send({
                    type: 'komut_sonucu',
                    resultMessage: 'Kanal yönetimi komutu işlenirken hata oluştu.',
                    interactionId: msg.interactionId
                });
            }
        }
    }
});

async function shutdown() {
    stopBot(false);
    await clearCaptchaState("Shutdown");
    clearAllTrackedTimeouts();
    client.destroy();
    process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception in selfbot:', error);
    stopBot(false);
});

process.on('unhandledRejection', (reason) => {
    console.error('❌ Unhandled rejection in selfbot:', reason);
    stopBot(false);
});
