const { botState, stopBot, resumeBot, toggleBooleanState } = require('../core/state');
const { clearCaptchaState } = require('../handlers/messageHandler');
const { FARMING_LIMITS } = require('../constants/timeouts');

class IPCHandler {
    constructor(client) {
        this.client = client;
    }

    /**
     * Send result back to main process
     */
    sendResult(interactionId, message, type = 'komut_sonucu') {
        if (process.send) {
            process.send({
                type,
                resultMessage: message,
                interactionId,
                isOwoEnabled: botState.isOwoEnabled
            });
        }
    }

    /**
     * Handle incoming IPC messages
     */
    async handleMessage(msg) {
        try {
            switch (msg.type) {
                case 'komut_kullanildi':
                    await this.handleCommand(msg);
                    break;
                case 'channels_command':
                    await this.handleChannelsCommand(msg);
                    break;
            }
        } catch (error) {
            console.error('❌ IPC Message Handler Error:', error);
            this.sendResult(msg.interactionId, 'İşlem sırasında beklenmedik bir hata oluştu.');
        }
    }

    /**
     * Handle 'komut_kullanildi' messages
     */
    async handleCommand(msg) {
        if (msg.command === 'farm') {
            await this.handleFarmCommand(msg);
        }
    }

    /**
     * Handle farm command logic
     */
    async handleFarmCommand(msg) {
        const { farmType, channelId } = msg;
        let resultMessage = '';

        if (farmType === 'this_channel') {
            resultMessage = this.handleTimedFarm(channelId);
        } else if (farmType === 'permanent_channels') {
            resultMessage = this.handlePermanentFarm();
        }

        this.sendResult(msg.interactionId, resultMessage);
    }

    /**
     * Handle timed farming logic (10 mins)
     */
    handleTimedFarm(channelId) {
        // Ensure channel timer exists
        if (!botState.timedChannels[channelId]) {
            botState.timedChannels[channelId] = { elapsed: 0 };
        }
        
        const channelTimer = botState.timedChannels[channelId];

        // Check if time limit exceeded
        if (channelTimer.elapsed >= FARMING_LIMITS.CHANNEL_FARM_LIMIT) {
            return "Bu kanalda 10 dakika oynadınız, lütfen başka bir kanala geçin.";
        }

        // Handle switching channels
        if (botState.activeTimedFarm.channelId && botState.activeTimedFarm.channelId !== channelId) {
            this.clearActiveTimedFarm();
        }

        const isStarting = !botState.isOwoEnabled || botState.activeTimedFarm.channelId !== channelId;
        
        if (isStarting) {
            return this.startTimedFarm(channelId, channelTimer);
        } else {
            return this.stopTimedFarm(channelTimer);
        }
    }

    /**
     * Start timed farming session
     */
    startTimedFarm(channelId, channelTimer) {
        // Reset expired timers
        for (const [id, timer] of Object.entries(botState.timedChannels)) {
            if (timer?.elapsed >= FARMING_LIMITS.CHANNEL_FARM_LIMIT) {
                botState.timedChannels[id].elapsed = 0;
            }
        }

        const remainingTime = FARMING_LIMITS.CHANNEL_FARM_LIMIT - channelTimer.elapsed;
        
        botState.tempFarmChannel = channelId;
        botState.activeTimedFarm = {
            channelId,
            startTime: Date.now(),
            timeoutId: setTimeout(() => {
                if (botState.activeTimedFarm.channelId === channelId) {
                    this.stopTimedFarm(channelTimer, true);
                }
            }, remainingTime)
        };

        botState.isOwoEnabled = true;
        resumeBot();
        
        return `Farm bu kanalda başlatıldı. Kalan süre: ${Math.round(remainingTime / 60000)} dakika.`;
    }

    /**
     * Stop active timed farm
     */
    stopTimedFarm(channelTimer, automatic = false) {
        if (botState.activeTimedFarm.timeoutId) {
            clearTimeout(botState.activeTimedFarm.timeoutId);
        }

        if (botState.activeTimedFarm.startTime) {
            channelTimer.elapsed += (Date.now() - botState.activeTimedFarm.startTime);
        }

        this.clearActiveTimedFarm();
        stopBot();
        botState.isOwoEnabled = false;

        return automatic ? null : 'Farm duraklatıldı.';
    }

    /**
     * Clear active farm state
     */
    clearActiveTimedFarm() {
        const oldId = botState.activeTimedFarm.channelId;
        if (oldId && botState.timedChannels[oldId] && botState.activeTimedFarm.startTime) {
             botState.timedChannels[oldId].elapsed += (Date.now() - botState.activeTimedFarm.startTime);
        }
        
        botState.activeTimedFarm = { channelId: null, startTime: null, timeoutId: null };
        botState.tempFarmChannel = null;
    }

    /**
     * Handle permanent channel farming toggle
     */
    handlePermanentFarm() {
        if (botState.channelIds.length === 0) {
            return 'Farm yapmak için kalıcı kanal listesi boş.';
        }

        toggleBooleanState('isOwoEnabled', 'Owo Farm');
        
        if (botState.isOwoEnabled) {
            resumeBot();
            return 'Kalıcı listedeki kanallar için farm etkinleştirildi.';
        } else {
            stopBot();
            return 'Farm devre dışı bırakıldı.';
        }
    }

    /**
     * Handle channels management command
     */
    async handleChannelsCommand(msg) {
        let resultMessage = '';

        if (msg.action === 'add') {
            resultMessage = this.addChannels(msg.channelIds);
        } else if (msg.action === 'clear') {
            botState.channelIds = [];
            resultMessage = 'Kalıcı kanal listesi temizlendi.';
        } else {
            resultMessage = 'Geçersiz işlem.';
        }

        this.sendResult(msg.interactionId, resultMessage);
    }

    /**
     * Add channels to the list
     */
    addChannels(rawIds) {
        if (!rawIds) return 'Kanal ID\'leri belirtilmelidir.';

        const ids = rawIds.split(',').map(id => id.trim()).filter(id => id.length > 0);
        const validIds = ids.filter(id => /^\d+$/.test(id));
        const invalidIds = ids.filter(id => !/^\d+$/.test(id));

        if (invalidIds.length > 0) {
            return `Geçersiz ID'ler: ${invalidIds.join(', ')}`;
        }

        botState.channelIds = [...new Set([...botState.channelIds, ...validIds])];
        return `${validIds.length} kanal eklendi. Toplam: ${botState.channelIds.length}`;
    }
}

module.exports = IPCHandler;
