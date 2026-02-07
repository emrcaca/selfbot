/**
 * Bot state management
 */

const interactionHandlers = new Map();
const authorizedUserIds = new Set();
const captchaDmMessages = new Map();
let isOwoEnabled = false;

module.exports = {
    interactionHandlers,
    authorizedUserIds,
    captchaDmMessages,
    get isOwoEnabled() { return isOwoEnabled; },
    set isOwoEnabled(value) { isOwoEnabled = value; }
};