/**
 * User State Module
 *
 * Manages user-specific state including user channel lists,
 * user-specific settings, and user tracking.
 *
 * @module core/state/userState
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default user state values
 */
const DEFAULT_USER_STATE = {
    userChannelLists: new Map(),
    enableConsoleLog: false
};

// ============================================================================
// USER STATE CLASS
// ============================================================================

/**
 * User State Manager
 *
 * Manages all user-related state including:
 * - User-specific channel lists
 * - User-specific settings
 * - User tracking
 */
class UserState {
    constructor() {
        /** @type {Object} The user state object */
        this.state = { ...DEFAULT_USER_STATE };
    }

    /**
     * Get the current user state
     * @returns {Object} Copy of the user state
     */
    getState() {
        return {
            ...this.state,
            userChannelLists: new Map(this.state.userChannelLists)
        };
    }

    /**
     * Set the user state
     * @param {Object} newState - New state values to merge
     */
    setState(newState) {
        this.state = { ...this.state, ...newState };
    }

    /**
     * Reset user state to default values
     */
    reset() {
        this.state = { ...DEFAULT_USER_STATE };
    }

    /**
     * Check if console logging is enabled
     * @returns {boolean} Whether console logging is enabled
     */
    isConsoleLogEnabled() {
        return this.state.enableConsoleLog;
    }

    /**
     * Set console logging enabled status
     * @param {boolean} enabled - Whether console logging should be enabled
     */
    setConsoleLogEnabled(enabled) {
        this.state.enableConsoleLog = enabled;
    }

    /**
     * Get channel list for a specific user
     * @param {string} userId - User ID
     * @returns {string[]} Array of channel IDs for the user
     */
    getUserChannelList(userId) {
        return this.state.userChannelLists.get(userId) || [];
    }

    /**
     * Set channel list for a specific user
     * @param {string} userId - User ID
     * @param {string[]} channelIds - Array of channel IDs
     */
    setUserChannelList(userId, channelIds) {
        this.state.userChannelLists.set(userId, [...channelIds]);
    }

    /**
     * Check if user has a custom channel list
     * @param {string} userId - User ID
     * @returns {boolean} Whether user has custom channel list
     */
    hasUserChannelList(userId) {
        return this.state.userChannelLists.has(userId);
    }

    /**
     * Remove user-specific channel list
     * @param {string} userId - User ID
     * @returns {boolean} Whether list was removed
     */
    removeUserChannelList(userId) {
        return this.state.userChannelLists.delete(userId);
    }

    /**
     * Get all user channel lists
     * @returns {Map} Map of user ID to channel IDs
     */
    getAllUserChannelLists() {
        return new Map(this.state.userChannelLists);
    }

    /**
     * Clear all user channel lists
     */
    clearAllUserChannelLists() {
        this.state.userChannelLists.clear();
    }

    /**
     * Get count of users with custom channel lists
     * @returns {number} Count of users
     */
    getUserCount() {
        return this.state.userChannelLists.size;
    }

    /**
     * Get all user IDs with custom channel lists
     * @returns {string[]} Array of user IDs
     */
    getAllUserIds() {
        return Array.from(this.state.userChannelLists.keys());
    }

    /**
     * Add a channel to user's channel list
     * @param {string} userId - User ID
     * @param {string} channelId - Channel ID to add
     */
    addChannelToUserList(userId, channelId) {
        const channelList = this.getUserChannelList(userId);
        if (!channelList.includes(channelId)) {
            channelList.push(channelId);
            this.setUserChannelList(userId, channelList);
        }
    }

    /**
     * Remove a channel from user's channel list
     * @param {string} userId - User ID
     * @param {string} channelId - Channel ID to remove
     * @returns {boolean} Whether channel was removed
     */
    removeChannelFromUserList(userId, channelId) {
        const channelList = this.getUserChannelList(userId);
        const index = channelList.indexOf(channelId);
        if (index !== -1) {
            channelList.splice(index, 1);
            this.setUserChannelList(userId, channelList);
            return true;
        }
        return false;
    }

    /**
     * Check if user has a specific channel in their list
     * @param {string} userId - User ID
     * @param {string} channelId - Channel ID to check
     * @returns {boolean} Whether user has channel in list
     */
    userHasChannel(userId, channelId) {
        const channelList = this.getUserChannelList(userId);
        return channelList.includes(channelId);
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    DEFAULT_USER_STATE,
    UserState
};
