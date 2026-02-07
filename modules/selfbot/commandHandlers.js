const { botState, stopBot, resumeBot, toggleBooleanState } = require('../core/state');
const { Loggers } = require('../utils/logger');

const TEN_MINUTES_MS = 10 * 60 * 1000;

/**
 * Handle farm command
 * @param {Object} msg - Message object
 * @returns {string} Result message
 */
function handleFarmCommand(msg) {
    const farmType = msg.farmType;
    const interactionChannelId = msg.channelId;
    let resultMessage = '';

    if (farmType === 'this_channel') {
        resultMessage = handleChannelFarm(interactionChannelId);
    } else if (farmType === 'permanent_channels') {
        resultMessage = handlePermanentFarm();
    }

    return resultMessage;
}

/**
 * Handle channel farm (temporary farm on specific channel)
 * @param {string} channelId - Channel ID
 * @returns {string} Result message
 */
function handleChannelFarm(channelId) {
    if (!botState.timedChannels[channelId]) {
        botState.timedChannels[channelId] = { elapsed: 0 };
    }
    const channelTimer = botState.timedChannels[channelId];

    if (channelTimer.elapsed >= TEN_MINUTES_MS) {
        return "Bu kanalda 10 dakika oynadınız, lütfen başka bir kanala geçin.";
    }

    handlePreviousTimedFarm(channelId);

    const isStarting = !botState.isOwoEnabled || botState.activeTimedFarm.channelId !== channelId;
    botState.isOwoEnabled = isStarting;

    if (isStarting) {
        return startChannelFarm(channelId, channelTimer);
    } else {
        return stopChannelFarm(channelId, channelTimer);
    }
}

/**
 * Handle previous timed farm cleanup
 * @param {string} newChannelId - New channel ID
 */
function handlePreviousTimedFarm(newChannelId) {
    if (botState.activeTimedFarm.channelId && botState.activeTimedFarm.channelId !== newChannelId) {
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
}

/**
 * Start channel farm
 * @param {string} channelId - Channel ID
 * @param {Object} channelTimer - Channel timer object
 * @returns {string} Result message
 */
function startChannelFarm(channelId, channelTimer) {
    // Reset expired timers
    for (const [chanId, timer] of Object.entries(botState.timedChannels)) {
        if (timer && typeof timer.elapsed === 'number' && timer.elapsed >= TEN_MINUTES_MS) {
            botState.timedChannels[chanId].elapsed = 0;
        }
    }

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

    return `Farm bu kanalda başlatıldı. Kalan süre: ${Math.round(remainingTime / 60000)} dakika.`;
}

/**
 * Stop channel farm
 * @param {string} channelId - Channel ID
 * @param {Object} channelTimer - Channel timer object
 * @returns {string} Result message
 */
function stopChannelFarm(channelId, channelTimer) {
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

    return 'Farm duraklatıldı.';
}

/**
 * Handle permanent farm (loop on all configured channels)
 * @returns {string} Result message
 */
function handlePermanentFarm() {
    if (botState.channelIds.length === 0) {
        return 'Farm yapmak için kalıcı kanal listesi boş veya belirli bir kanal belirtilmedi.';
    }

    toggleBooleanState('isOwoEnabled', 'Owo Farm');
    if (botState.isOwoEnabled) {
        resumeBot();
        return 'Kalıcı listedeki kanallar için farm etkinleştirildi. Kısa süre içinde başlayacaktır.';
    } else {
        stopBot();
        return 'Farm devre dışı bırakıldı.';
    }
}

module.exports = {
    handleFarmCommand,
    handleChannelFarm,
    handlePermanentFarm,
    TEN_MINUTES_MS
};