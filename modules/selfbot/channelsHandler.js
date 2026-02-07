const { botState } = require('../core/state');
const { Loggers } = require('../utils/logger');

/**
 * Handle channels command
 * @param {Object} msg - Message object
 * @returns {string} Result message
 */
function handleChannelsCommand(msg) {
    const { action, channelIds } = msg;

    switch (action) {
        case 'add':
            return handleAddChannelIds(channelIds);
        case 'clear':
            return handleClearChannelIds();
        default:
            return 'Geçersiz işlem.';
    }
}

/**
 * Handle add channel IDs action
 * @param {string} channelIdsString - Comma-separated channel IDs
 * @returns {string} Result message
 */
function handleAddChannelIds(channelIdsString) {
    if (!channelIdsString) {
        return 'Kanal ID\'leri belirtilmelidir.';
    }

    const { validIds, invalidIds } = parseAndValidateChannelIds(channelIdsString);

    if (invalidIds.length > 0) {
        return `Geçersiz kanal ID'leri: ${invalidIds.join(', ')}. Sadece sayısal değerler kabul edilir.`;
    }

    // Add valid channel IDs to the list
    botState.channelIds = [...new Set([...botState.channelIds, ...validIds])];
    return `${validIds.length} kanal başarıyla eklendi. Toplam kanal sayısı: ${botState.channelIds.length}`;
}

/**
 * Parse and validate channel IDs
 * @param {string} channelIdsString - Comma-separated channel IDs
 * @returns {Object} Object with validIds and invalidIds arrays
 */
function parseAndValidateChannelIds(channelIdsString) {
    const channelIds = channelIdsString.split(',').map(id => id.trim()).filter(id => id.length > 0);
    const validIds = [];
    const invalidIds = [];

    for (const id of channelIds) {
        if (/^\d+$/.test(id)) {
            validIds.push(id);
        } else {
            invalidIds.push(id);
        }
    }

    return { validIds, invalidIds };
}

/**
 * Handle clear channel IDs action
 * @returns {string} Result message
 */
function handleClearChannelIds() {
    botState.channelIds = [];
    return 'Kalıcı kanal listesi başarıyla temizlendi.';
}

module.exports = {
    handleChannelsCommand,
    handleAddChannelIds,
    handleClearChannelIds
};