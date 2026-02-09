/**
 * IPC Message Builder Utility
 * Provides methods for building standardized IPC messages
 */

class IPCMessageBuilder {
    /**
     * Build a CAPTCHA detection notification message
     * @param {Object} params - Message parameters
     * @param {string} params.userId - User ID
     * @param {string} params.username - Username
     * @param {string} params.messageId - Message ID
     * @param {string} params.channelId - Channel ID
     * @param {string} params.guildId - Guild ID (optional)
     * @param {string} params.guildName - Guild name (optional)
     * @param {string} params.channelName - Channel name (optional)
     * @returns {Object} IPC message object
     */
    static buildCaptchaNotification({
        userId,
        username,
        messageId,
        channelId,
        guildId = null,
        guildName = 'Unknown',
        channelName = 'Unknown'
    }) {
        return {
            type: 'captcha',
            userId,
            username,
            messageId,
            channelId,
            guildId,
            guildName,
            channelName
        };
    }

    /**
     * Build a CAPTCHA solved notification message
     * @param {string} userId - User ID
     * @returns {Object} IPC message object
     */
    static buildCaptchaSolved(userId) {
        return {
            type: 'captcha_solved',
            userId
        };
    }

    /**
     * Build a channel monitor alert message
     * @param {Object} params - Message parameters
     * @param {string} params.userId - User ID
     * @param {string} params.channelId - Channel ID
     * @param {string} params.author - Message author username
     * @param {string} params.content - Message content
     * @returns {Object} IPC message object
     */
    static buildMonitorAlert({
        userId,
        channelId,
        author,
        content
    }) {
        // Truncate content if too long (limit to 100 chars)
        const truncatedContent = content.length > 100
            ? content.substring(0, 100) + '...'
            : content;

        return {
            type: 'channel_monitor_alert',
            userId,
            channelId,
            author,
            content: truncatedContent
        };
    }

    /**
     * Build selfbot ready notification message
     * @param {string} userId - User ID
     * @returns {Object} IPC message object
     */
    static buildSelfbotReady(userId) {
        return {
            type: 'selfbot_ready',
            userId
        };
    }

    /**
     * Build command result message for worker response
     * @param {Object} params - Message parameters
     * @param {string} params.interactionId - Interaction ID
     * @param {string} params.resultMessage - Result message text
     * @param {boolean} params.isOwoEnabled - OWO farming enabled status
     * @returns {Object} IPC message object
     */
    static buildCommandResult({
        interactionId,
        resultMessage,
        isOwoEnabled = false
    }) {
        return {
            type: 'komut_sonucu',
            interactionId,
            resultMessage,
            isOwoEnabled
        };
    }

    /**
     * Build command usage message from notifier
     * @param {Object} params - Message parameters
     * @param {string} params.command - Command to execute
     * @param {string} params.channelId - Channel ID
     * @param {string} params.targetUserId - Target user ID
     * @param {string} params.interactionId - Interaction ID
     * @param {string} params.farmType - Farm type (optional)
     * @returns {Object} IPC message object
     */
    static buildCommandUsage({
        command,
        channelId,
        targetUserId,
        interactionId,
        farmType = null
    }) {
        const message = {
            type: 'komut_kullanildi',
            command,
            channelId,
            targetUserId,
            interactionId
        };

        if (farmType) {
            message.farmType = farmType;
        }

        return message;
    }

    /**
     * Build channels management command message
     * @param {Object} params - Message parameters
     * @param {string} params.action - Action to perform ('add' or 'clear')
     * @param {string} params.channelIds - Comma-separated channel IDs
     * @param {string} params.targetUserId - Target user ID
     * @param {string} params.interactionId - Interaction ID
     * @returns {Object} IPC message object
     */
    static buildChannelsCommand({
        action,
        channelIds,
        targetUserId,
        interactionId
    }) {
        return {
            type: 'channels_command',
            action,
            channelIds,
            targetUserId,
            interactionId
        };
    }

    /**
     * Build OWO status update message
     * @param {boolean} isOwoEnabled - OWO farming enabled status
     * @returns {Object} IPC message object
     */
    static buildOwoStatusUpdate(isOwoEnabled) {
        return {
            type: 'owo_status_update',
            isOwoEnabled
        };
    }
}

module.exports = IPCMessageBuilder;
