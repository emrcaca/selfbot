/**
 * Farming Module
 *
 * Handles all farming operations including OWO commands, WHWB commands,
 * channel cycling, and random sleep intervals to make the bot behavior
 * appear more natural.
 *
 * @module core/farming
 */

const { botState, DELAYS, PROBABILITIES } = require('./state');
const { shouldRunLoop } = require('./state');
const { sendTyping, sendMessage, getChannel } = require('../services/discordService');
const { getRandomInt, delay } = require('../utils/helpers');
const { logError } = require('../utils/errorHandler');
const { Loggers } = require('../utils/logger');

// ============================================================================
// STATE TRACKERS (HUMANIZER)
// ============================================================================

let alreadyTypedOwo = false;
let alreadyTypedWhwb = false;

// ============================================================================
// CONSTANTS
// ============================================================================

/** Command strings for farming */
const COMMANDS = {
    OWO: 'Owo',
    WH: 'Owo h',
    WB: 'Owo b'
};

/** Delay ranges in milliseconds */
const LOOP_DELAYS = {
    /** Delay between loop iterations */
    ITERATION: { MIN: 200, MAX: 1000 },
    /** Delay after errors */
    ERROR_RECOVERY: 5000,
    /** Delay after critical errors */
    CRITICAL_ERROR: 10000
};

// ============================================================================
// CHANNEL MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Get the current channel ID for farming
 *
 * Returns the temporary farm channel if set, otherwise returns
 * the current channel from the rotation list.
 *
 * @returns {string|null} Channel ID or null if none available
 */
function getCurrentChannelId() {
    // Priority: temporary farm channel > rotation list
    if (botState.tempFarmChannel) {
        return botState.tempFarmChannel;
    }

    if (botState.channelIds.length === 0) {
        return null;
    }

    return botState.channelIds[botState.currentChannelIndex];
}

/**
 * Advance to the next channel in the rotation
 *
 * Moves the current channel index to the next position in the
 * channel list, wrapping around to the beginning if necessary.
 *
 * @returns {string|null} New channel ID or null if no channels available
 */
function advanceToNextChannel() {
    if (botState.channelIds.length === 0) {
        return null;
    }

    const oldChannelId = botState.channelIds[botState.currentChannelIndex];
    botState.currentChannelIndex = (botState.currentChannelIndex + 1) % botState.channelIds.length;
    const newChannelId = botState.channelIds[botState.currentChannelIndex];

    Loggers.Farm.info(`Channel advanced. Old: ${oldChannelId}, New: ${newChannelId}`);

    return newChannelId;
}

// ============================================================================
// SLEEP MANAGEMENT
// ============================================================================

/**
 * Random sleep functionality for the bot
 *
 * Randomly enters sleep mode based on the sleep probability
 * configuration. This makes the bot appear more natural by
 * taking breaks at random intervals.
 *
 * @returns {Promise<void>}
 */
async function performRandomSleep() {
    if (!shouldRunLoop()) {
        return;
    }

    // Only sleep based on probability
    if (Math.random() >= PROBABILITIES.SLEEP) {
        return;
    }

    botState.isSleeping = true;

    const sleepDuration = getRandomInt(DELAYS.SLEEP.MIN, DELAYS.SLEEP.MAX);
    const sleepDurationSeconds = Math.round(sleepDuration / 1000);

    Loggers.Farm.info(`Bot entering sleep mode for ${sleepDurationSeconds}s`);

    try {
        await delay(sleepDuration);
    } finally {
        botState.isSleeping = false;
        Loggers.Farm.info('Bot woke up from sleep');
    }
}

// ============================================================================
// FARMING LOOPS
// ============================================================================

/**
 * Gecikme süresini hesaplar (yazma ve mesaj gecikmelerini düşer)
 * 
 * @param {Object} delayRange - Ana gecikme aralığı {MIN, MAX}
 * @returns {number} Ayarlanmış gecikme süresi
 */
function calculateAdjustedDelay(delayRange) {
    const baseDelay = getRandomInt(delayRange.MIN, delayRange.MAX);
    const typingDelay = getRandomInt(DELAYS.TYPING.MIN, DELAYS.TYPING.MAX);
    const messageDelay = getRandomInt(DELAYS.MESSAGE.MIN, DELAYS.MESSAGE.MAX);
    
    // En az 0 olacak şekilde hesapla
    return Math.max(0, baseDelay - typingDelay - messageDelay);
}

/**
 * Main loop for OWO farming
 *
 * Continuously sends the OWO command to the current farming channel.
 * Includes random delays, typing indicators, and error handling.
 *
 * @param {Client} client - Discord client instance
 * @returns {Promise<void>} Never resolves (runs indefinitely)
 */
async function owoLoop(client) {
    Loggers.Farm.info('Starting OWO farming loop');

    while (true) {
        try {
            // Random delay between iterations
            await delay(getRandomInt(LOOP_DELAYS.ITERATION.MIN, LOOP_DELAYS.ITERATION.MAX));

            // Check if we should continue the loop
            if (!shouldRunLoop('owo')) {
                continue;
            }

            // Get the current channel
            const channelId = getCurrentChannelId();
            if (!channelId) {
                continue;
            }

            // Mark as processing
            botState.isProcessingOwo = true;

            try {
                // Send typing indicator if not already done early in the cooldown
                if (!alreadyTypedOwo) {
                    await sendTyping(client, channelId, COMMANDS.OWO);
                } else {
                    alreadyTypedOwo = false; // Reset
                }

                // Send OWO command
                await sendMessage(client, channelId, COMMANDS.OWO);
                Loggers.Farm.info(`OWO command sent to channel: ${channelId}`);

                // Random sleep after command
                await performRandomSleep();

            } catch (error) {
                Loggers.Farm.error(`Error sending OWO command: ${error.message}`);
                await delay(LOOP_DELAYS.ERROR_RECOVERY);
            } finally {
                botState.isProcessingOwo = false;

                const adjustedDelay = calculateAdjustedDelay(DELAYS.OWO);
                alreadyTypedOwo = await performFarmingCooldownDelay(client, channelId, COMMANDS.OWO, adjustedDelay);
            }

        } catch (error) {
            logError('FARMING_OWO_LOOP', error);
            await delay(LOOP_DELAYS.CRITICAL_ERROR);
        }
    }
}

/**
 * Main loop for WHWB farming
 *
 * Continuously sends the WH and WB commands to the current farming channel.
 * These commands are sent in sequence with a short delay between them.
 *
 * @param {Client} client - Discord client instance
 * @returns {Promise<void>} Never resolves (runs indefinitely)
 */
async function whwbLoop(client) {
    Loggers.Farm.info('Starting WHWB farming loop');

    while (true) {
        try {
            // Random delay between iterations
            await delay(getRandomInt(LOOP_DELAYS.ITERATION.MIN, LOOP_DELAYS.ITERATION.MAX));

            // Check if we should continue the loop
            if (!shouldRunLoop('whwb')) {
                continue;
            }

            // Get the current channel
            const channelId = getCurrentChannelId();
            if (!channelId) {
                continue;
            }

            // Mark as processing
            botState.isProcessingWhWb = true;

            try {
                // Send typing indicator if not already done early in the cooldown
                if (!alreadyTypedWhwb) {
                    await sendTyping(client, channelId, COMMANDS.WH);
                } else {
                    alreadyTypedWhwb = false; // Reset
                }

                // Send WH command
                const whSent = await sendMessage(client, channelId, COMMANDS.WH);

                if (whSent) {
                    // Delay between WH and WB
                    await delay(getRandomInt(DELAYS.MESSAGE.MIN, DELAYS.MESSAGE.MAX));

                    // Send typing indicator before WB
                    await sendTyping(client, channelId, COMMANDS.WB);

                    // Send WB command
                    await sendMessage(client, channelId, COMMANDS.WB);
                    Loggers.Farm.info(`WH/WB commands sent to channel: ${channelId}`);
                }

                // Random sleep after commands
                await performRandomSleep();

            } catch (error) {
                Loggers.Farm.error(`Error sending WH/WB commands: ${error.message}`);
                await delay(LOOP_DELAYS.ERROR_RECOVERY);
            } finally {
                botState.isProcessingWhWb = false;

                const adjustedDelay = calculateAdjustedDelay(DELAYS.WHWB);
                alreadyTypedWhwb = await performFarmingCooldownDelay(client, channelId, COMMANDS.WH, adjustedDelay);
            }

        } catch (error) {
            logError('FARMING_WHWB_LOOP', error);
            await delay(LOOP_DELAYS.CRITICAL_ERROR);
        }
    }
}

/**
 * Channel cycling functionality
 *
 * Periodically advances to the next channel in the rotation list.
 * This is useful for distributing farming across multiple channels.
 *
 * @param {Client} client - Discord client instance
 * @returns {Promise<void>} Never resolves (runs indefinitely)
 */
async function cycleChannels(client) {
    // Don't start cycling if using temporary farm or only one channel
    if (botState.tempFarmChannel || botState.channelIds.length <= 1) {
        Loggers.Farm.info('Channel cycling disabled (temporary farm or single channel)');
        return;
    }

    Loggers.Farm.info('Starting channel cycling loop');

    while (true) {
        try {
            // Wait for the cycle delay
            const cycleDelay = getRandomInt(DELAYS.CHANNEL_CYCLE.MIN, DELAYS.CHANNEL_CYCLE.MAX);
            await delay(cycleDelay);

            // Check if we should cycle channels
            if (!shouldRunLoop()) {
                continue;
            }

            // Don't cycle if using temporary farm channel
            if (botState.tempFarmChannel) {
                continue;
            }

            // Don't cycle if only one channel
            if (botState.channelIds.length <= 1) {
                continue;
            }

            // Ensure client is ready
            if (!client?.user) {
                continue;
            }

            // Advance to next channel
            advanceToNextChannel();

        } catch (error) {
            Loggers.Farm.error(`Channel cycling error: ${error.message}`);
            await delay(LOOP_DELAYS.CRITICAL_ERROR);
        }
    }
}

/**
 * Background loop that checks every 10 seconds.
 * With a very low probability, it triggers a micro-pause (sleep)
 * for a random duration between 30 and 90 seconds.
 * 
 * @param {Client} client - Discord client instance
 * @returns {Promise<void>}
 */
async function microPauseLoop(client) {
    Loggers.Farm.info('Starting Micro Pause background check loop');

    // 10 saniyede bir kontrol et
    const CHECK_INTERVAL = 10000;
    
    // Mikro duraklama olasılığı (%2.5 olasılık)
    const MICRO_PAUSE_PROBABILITY = 0.025; 

    // Duraklama süresi sınırları (30 saniye ile 90 saniye arası)
    const PAUSE_DURATION = { MIN: 30000, MAX: 90000 };

    while (true) {
        try {
            await delay(CHECK_INTERVAL);

            // Bot çalışıyor olmalı, farm aktif olmalı, halihazırda uyumuyor veya captcha almamış olmalı
            if (botState.isRunning && botState.isOwoEnabled && !botState.isSleeping && !botState.captchaDetected) {
                
                // Çok düşük ihtimal kontrolü
                if (Math.random() < MICRO_PAUSE_PROBABILITY) {
                    const pauseTime = getRandomInt(PAUSE_DURATION.MIN, PAUSE_DURATION.MAX);
                    const pauseTimeSeconds = Math.round(pauseTime / 1000);

                    Loggers.Farm.info(`[MICRO-PAUSE] Farm 10 saniyelik kontrol sonucu rastgele olarak ${pauseTimeSeconds}s duraklatıldı.`);
                    
                    botState.isSleeping = true;

                    const step = 1000; // 1 saniyelik adımlarla bekle
                    let elapsed = 0;
                    let cancelled = false;

                    try {
                        while (elapsed < pauseTime) {
                            await delay(step);
                            elapsed += step;
                            
                            // Eğer bu esnada kullanıcı farmı durdurduysa duraklamayı anında iptal et
                            if (!botState.isRunning || !botState.isOwoEnabled || botState.captchaDetected) {
                                cancelled = true;
                                Loggers.Farm.info('[MICRO-PAUSE] Farm durdurulduğu veya CAPTCHA tespit edildiği için aktif mikro duraklama iptal edildi.');
                                break;
                            }
                        }
                    } finally {
                        botState.isSleeping = false;
                        if (!cancelled && botState.isRunning && botState.isOwoEnabled && !botState.captchaDetected) {
                            Loggers.Farm.info('[MICRO-PAUSE] Farm duraklaması sona erdi, devam ediliyor.');
                        }
                    }
                }
            }
        } catch (error) {
            Loggers.Farm.error(`Error in microPauseLoop: ${error.message}`);
        }
    }
}

/**
 * Metot, bir sonraki komuttan önceki cooldown süresini bekler.
 * %25 ihtimalle, bekleme süresinin son 2-4 saniyesinde "yazıyor..." durumunu başlatır,
 * böylece bot sanki elinde komut hazır şekilde cooldown'un bitmesini bekliyormuş gibi görünür.
 * 
 * Bu bekleme işlemi 1 saniyelik adımlarla yapılır, böylece bot durdurulursa bekleme anında kesilir.
 */
async function performFarmingCooldownDelay(client, channelId, nextCommand, totalDelay) {
    const READY_WAIT_PROBABILITY = 0.25; // %25 ihtimalle hazırda beklesin

    const isReadyWait = Math.random() < READY_WAIT_PROBABILITY && totalDelay > 5000;
    
    let silentDelay = totalDelay;
    let typingDelay = 0;
    let typingStarted = false;

    if (isReadyWait) {
        const earlyTypingTime = getRandomInt(2000, 4000);
        silentDelay = Math.max(1000, totalDelay - earlyTypingTime);
        typingDelay = totalDelay - silentDelay;
    }

    const step = 1000;
    let elapsed = 0;

    // 1. Aşama: Sessiz bekleme
    while (elapsed < silentDelay) {
        if (!botState.isRunning || !botState.isOwoEnabled || botState.captchaDetected) {
            return false;
        }
        await delay(Math.min(step, silentDelay - elapsed));
        elapsed += step;
    }

    // 2. Aşama: Eğer hazırda bekleyeceksek yazmayı başlat
    if (isReadyWait && botState.isRunning && botState.isOwoEnabled && !botState.captchaDetected) {
        const channel = await getChannel(client, channelId);
        if (channel?.isText() && channel.type !== 'GUILD_FORUM') {
            try {
                await channel.sendTyping();
                typingStarted = true;
                Loggers.Farm.info(`[HUMANIZER] Cooldown bitimi beklenirken erken yazıyor durumu tetiklendi (Kalan süre: ${Math.round(typingDelay / 1000)}s)`);
            } catch {}
        }
    }

    // 3. Aşama: Kalan süreyi bekle (yazarak veya normal)
    let elapsedTyping = 0;
    while (elapsedTyping < typingDelay) {
        if (!botState.isRunning || !botState.isOwoEnabled || botState.captchaDetected) {
            return false;
        }
        await delay(Math.min(step, typingDelay - elapsedTyping));
        elapsedTyping += step;
    }

    return typingStarted;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    // Main loops
    owoLoop,
    whwbLoop,
    cycleChannels,
    microPauseLoop,

    // Channel management
    getCurrentChannelId,
    advanceToNextChannel,

    // Utility functions
    performRandomSleep
};
