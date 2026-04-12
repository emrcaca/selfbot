/**
 * Message Handler Module
 *
 * Handles incoming Discord messages including:
 * - CAPTCHA detection and notification
 * - Channel monitoring for activity
 * - CAPTCHA verification (DM) handling
 *
 * @module handlers/messageHandler
 */

const configManager = require('../config/manager');
const { botState, CAPTCHA_KEYWORDS } = require('../core/state');
const { stopBot, resumeBot } = require('../core/state');
const { clearAllCaches } = require('../services/discordService');
const { delay } = require('../utils/helpers');
const { sendCaptchaNotification, sendCaptchaSolvedNotification, sendChannelAlert } = require('../services/telegramService');
const { Loggers } = require('../utils/logger');

// ============================================================================
// CONSTANTS
// ============================================================================

/** Duration for tracking CAPTCHA notifications (ms) */
const CAPTCHA_NOTIFICATION_TRACK_DURATION = 10 * 60 * 1000; // 10 minutes

/** Delay after CAPTCHA verification before resuming (ms) */
const CAPTCHA_VERIFICATION_DELAY = 15000; // 15 seconds

/** Maximum message content length for alerts */
const MAX_ALERT_CONTENT_LENGTH = 100;

/** Zero-width character used by Discord */
// ============================================================================
// STATE
// ============================================================================

/**
 * Track sent CAPTCHA notifications to avoid duplicates
 * @type {Map<string, { sent: boolean, timestamp: number }>}
 */
const sentCaptchaNotifications = new Map();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get the OWO bot ID from configuration
 *
 * @returns {string} OWO bot ID
 */
function getOwoBotId() {
    const config = configManager.getConfig();
    return config ? config.owo_ID : '408785106942164992';
}

/**
 * Check if a message contains CAPTCHA keywords
 *
 * @param {string} content - Message content to check
 * @returns {string|null} Found keyword or null
 */
function detectCaptchaKeyword(content) {
    // Normalize content: lowercase and remove all zero-width spaces
    const normalizedContent = content.toLowerCase().replace(/[\u200B\u200C\u200D\uFEFF\u00AD\u2060\u180E\u200E\u200F\u202A-\u202E\u2061-\u2064\u206A-\u206F]/g, '');

    return CAPTCHA_KEYWORDS.find(keyword => normalizedContent.includes(keyword));
}

/**
 * Check if a message indicates CAPTCHA verification
 *
 * @param {string} content - Message content to check
 * @returns {boolean} True if verification detected
 */
function isCaptchaVerified(content) {
    const verificationPhrases = [
        'verified that you are human',
        'thank you for verifying'
    ];

    const normalizedContent = content.toLowerCase();
    return verificationPhrases.some(phrase => normalizedContent.includes(phrase));
}

/**
 * Truncate message content for alerts
 *
 * @param {string} content - Original content
 * @returns {string} Truncated content with ellipsis if needed
 */
function truncateContent(content) {
    if (!content) return 'N/A';

    if (content.length <= MAX_ALERT_CONTENT_LENGTH) {
        return content;
    }

    return content.substring(0, MAX_ALERT_CONTENT_LENGTH) + '...';
}

// ============================================================================
// CAPTCHA STATE MANAGEMENT
// ============================================================================

/**
 * Clear CAPTCHA state
 *
 * Resets the CAPTCHA detected flag and clears any stored
 * notification data. Also clears caches to free memory.
 *
 * @param {string} reason - Reason for clearing CAPTCHA state
 * @returns {Promise<void>}
 */
async function clearCaptchaState(reason) {
    Loggers.Captcha.info(`Clearing CAPTCHA state (Reason: ${reason})`);
    botState.captchaDetected = false;

    // Clear stored CAPTCHA notification data
    if (sentCaptchaNotifications.size > 0) {
        const count = sentCaptchaNotifications.size;
        Loggers.Captcha.debug(`Clearing ${count} stored CAPTCHA notification entries...`);
        sentCaptchaNotifications.clear();
        Loggers.Captcha.debug('Stored CAPTCHA notification entries cleared');
    }

    // Clear caches to free memory
    clearAllCaches();
}

/**
 * Check if a CAPTCHA notification was recently sent
 *
 * Prevents duplicate notifications within the tracking duration.
 *
 * @param {string} userId - User ID to check
 * @returns {boolean} True if notification was recently sent
 */
function wasCaptchaNotifiedRecently(userId) {
    const notification = sentCaptchaNotifications.get(userId);

    if (!notification) {
        return false;
    }

    const elapsed = Date.now() - notification.timestamp;
    if (elapsed > CAPTCHA_NOTIFICATION_TRACK_DURATION) {
        sentCaptchaNotifications.delete(userId);
        return false;
    }

    return true;
}

// ============================================================================
// CAPTCHA HANDLING
// ============================================================================

/**
 * Handle CAPTCHA notification
 *
 * Called when a CAPTCHA is detected. Stops the bot, sends
 * notifications to the main process and Telegram.
 *
 * @param {Client} client - Discord client instance
 * @param {Message} message - Discord message object
 * @returns {Promise<void>}
 */
async function handleCaptchaNotification(client, message) {
    Loggers.Captcha.debug('CAPTCHA detected! Starting debug logging...');
    Loggers.Captcha.debug(`Message content: ${message.content}`);
    Loggers.Captcha.debug(`Checking for CAPTCHA keywords: ${JSON.stringify(CAPTCHA_KEYWORDS)}`);

    // Stop the bot immediately
    stopBot(false);
    botState.captchaDetected = true;

    // Send notification to main process
    if (process.send) {
        Loggers.Captcha.debug('Sending CAPTCHA message to main.js...');
        process.send({
            type: 'captcha',
            userId: client.user.id,
            username: client.user.username,
            messageId: message.id,
            channelId: message.channel.id,
            guildId: message.guild?.id || null
        });
        Loggers.Captcha.debug('CAPTCHA message sent to main.js');
    } else {
        Loggers.Captcha.error('process.send is not available!');
    }

    // Send notification via Telegram
    try {
        const result = await sendCaptchaNotification({
            userId: client.user.id,
            username: client.user.username
        });

        if (result && result.success) {
            sentCaptchaNotifications.set(client.user.id, {
                sent: true,
                timestamp: Date.now()
            });
            Loggers.Captcha.info('CAPTCHA notification sent via Telegram');
        } else {
            Loggers.Captcha.warn('Failed to send CAPTCHA notification via Telegram');
        }
    } catch (error) {
        Loggers.Captcha.error(`Error sending Telegram notification: ${error.message}`);
    }
}

// ============================================================================
// CHANNEL MONITORING
// ============================================================================

/**
 * Check if a channel is a farming channel
 *
 * Determines if a channel is in the farming list or is the
 * currently active temporary farm channel.
 *
 * @param {string} channelId - Channel ID to check
 * @returns {boolean} True if channel is a farming channel
 */
function isFarmingChannel(channelId) {
    // Check if it's the temporary farm channel
    if (botState.tempFarmChannel === channelId) {
        return true;
    }

    // Check if it's in the channel list
    if (botState.channelIds.includes(channelId)) {
        return true;
    }

    // Check if it's the active timed farm channel
    if (botState.activeTimedFarm?.channelId === channelId) {
        return true;
    }

    return false;
}

/**
 * Handle channel monitoring alert
 *
 * Called when activity is detected in a farming channel.
 * Stops farming and sends alerts via Telegram and to the main process.
 *
 * @param {Client} client - Discord client instance
 * @param {Message} message - Discord message object
 * @returns {Promise<void>}
 */
async function handleChannelMonitoringAlert(client, message) {
    // Don't process if monitoring is disabled
    if (!botState.monitoring) {
        return;
    }

    // Don't process if farming is disabled
    if (!botState.isOwoEnabled) {
        return;
    }

    // Only process guild messages (not DMs)
    if (!message.guild || message.channel.type === 'DM') {
        return;
    }

    // Check if the channel is a farming channel
    if (!isFarmingChannel(message.channel.id)) {
        return;
    }

    // Ignore messages from bots and self
    if (message.author.bot || message.author.id === client.user.id) {
        return;
    }

    Loggers.Farm.info(`Activity detected in farming channel: ${message.channel.id}`);

    // Stop farming
    botState.isOwoEnabled = false;

    // Prepare alert data
    const alertData = {
        channelId: message.channel.id,
        author: message.author.username,
        content: truncateContent(message.content)
    };

    // Send alert via Telegram
    try {
        await sendChannelAlert(alertData);
    } catch (error) {
        Loggers.Farm.error(`Error sending Telegram alert: ${error.message}`);
    }

    // Send alert to main process
    if (process.send) {
        process.send({
            type: 'channel_monitor_alert',
            userId: client.user.id,
            channelId: alertData.channelId,
            author: alertData.author,
            content: alertData.content
        });
    }
}

// ============================================================================
// MESSAGE HANDLING
// ============================================================================

/**
 * Handle incoming messages
 *
 * Main entry point for processing incoming Discord messages.
 * Handles channel monitoring alerts and CAPTCHA detection.
 *
 * @param {Client} client - Discord client instance
 * @param {Message} message - Discord message object
 * @returns {Promise<void>}
 */
async function handleIncomingMessage(client, message) {
    try {
        // Handle channel monitoring alerts
        await handleChannelMonitoringAlert(client, message);

        // Handle CAPTCHA detection
        await handleCaptchaDetection(client, message);

    } catch (error) {
        Loggers.Captcha.error(`Error handling incoming message: ${error.message}`);
    }
}

/**
 * Handle CAPTCHA detection in incoming messages
 *
 * Checks messages from the OWO bot for CAPTCHA keywords
 * and triggers the CAPTCHA handling flow if detected.
 *
 * @param {Client} client - Discord client instance
 * @param {Message} message - Discord message object
 * @returns {Promise<void>}
 */
async function handleCaptchaDetection(client, message) {
    const owoBotId = getOwoBotId();

    // Only process messages from OWO bot
    if (message.author.id !== owoBotId) {
        return;
    }

    // Skip if CAPTCHA already detected
    if (botState.captchaDetected) {
        return;
    }

    // Only process DMs or messages mentioning the user
    if (message.channel.type !== 'DM' && !message.content.includes(`<@${client.user.id}>`)) {
        return;
    }

    // Check for CAPTCHA keywords
    const foundKeyword = detectCaptchaKeyword(message.content);

    if (foundKeyword) {
        Loggers.Captcha.debug(`CAPTCHA keyword detected in message: "${foundKeyword}"`);
        await handleCaptchaNotification(client, message);
    } else {
        Loggers.Captcha.debug('No CAPTCHA keywords found in message');
    }
}

// ============================================================================
// CAPTCHA VERIFICATION HANDLING
// ============================================================================

/**
 * Handle CAPTCHA DM messages
 *
 * Processes DM messages from the OWO bot that indicate
 * CAPTCHA verification completion.
 *
 * @param {Client} client - Discord client instance
 * @param {Message} message - Discord message object
 * @returns {Promise<void>}
 */
async function handleCaptchaDM(client, message) {
    const owoBotId = getOwoBotId();

    // Check if CAPTCHA DM handler is enabled
    if (!botState.isCaptchaDmHandlerEnabled) {
        return;
    }

    // Only process DMs from OWO bot
    if (message.channel.type !== 'DM' || message.author.id !== owoBotId) {
        return;
    }

    // Check if message indicates verification
    if (!isCaptchaVerified(message.content)) {
        return;
    }

    Loggers.Captcha.info('CAPTCHA verification detected');

    // Send CAPTCHA solved notification via Telegram
    try {
        await sendCaptchaSolvedNotification(client.user.id);
        Loggers.Captcha.info('CAPTCHA solved notification sent via Telegram');
    } catch (error) {
        Loggers.Captcha.error(`Error sending Telegram notification: ${error.message}`);
    }

    // Send captcha_solved message to main process
    if (process.send) {
        Loggers.Captcha.debug('Sending captcha_solved message to main.js...');
        process.send({
            type: 'captcha_solved',
            userId: client.user.id
        });
        Loggers.Captcha.debug('captcha_solved message sent');
    }

    // Clear CAPTCHA state
    await clearCaptchaState('Verification received');

    // Wait before resuming
    await delay(CAPTCHA_VERIFICATION_DELAY);

    // Resume bot if not already running
    if (!botState.isRunning) {
        resumeBot();
        // Note: Status updates are disabled to avoid detection
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    // Main handlers
    handleIncomingMessage,
    handleCaptchaDM,

    // CAPTCHA handling
    handleCaptchaNotification,
    clearCaptchaState,

    // Utility functions
    getOwoBotId,
    detectCaptchaKeyword,
    isCaptchaVerified,
    isFarmingChannel
};