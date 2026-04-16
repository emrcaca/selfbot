/**
 * Farming State Module
 *
 * Manages state related to farming operations including OWO/WHWB farming,
 * channel management, and sleep mode.
 *
 * @module core/state/farmingState
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default farming state values
 */
const DEFAULT_FARMING_STATE = {
    isRunning: false,
    isOwoEnabled: false,
    isSleeping: false,
    isProcessingOwo: false,
    isProcessingWhWb: false,
    currentChannelIndex: 0,
    channelIds: [],
    tempFarmChannel: null
};

// ============================================================================
// FARMING STATE CLASS
// ============================================================================

/**
 * Farming State Manager
 *
 * Manages all farming-related state including:
 * - Farming status (running, enabled, sleeping)
 * - Channel management (rotation, temporary farming)
 * - Processing flags (OWO, WHWB)
 */
class FarmingState {
    constructor() {
        /** @type {Object} The farming state object */
        this.state = { ...DEFAULT_FARMING_STATE };
    }

    /**
     * Get the current farming state
     * @returns {Object} Copy of the farming state
     */
    getState() {
        return { ...this.state };
    }

    /**
     * Set the farming state
     * @param {Object} newState - New state values to merge
     */
    setState(newState) {
        this.state = { ...this.state, ...newState };
    }

    /**
     * Reset farming state to default values
     */
    reset() {
        this.state = { ...DEFAULT_FARMING_STATE };
    }

    /**
     * Check if farming is running
     * @returns {boolean} Whether farming is running
     */
    isRunning() {
        return this.state.isRunning;
    }

    /**
     * Set farming running status
     * @param {boolean} running - Whether farming should be running
     */
    setRunning(running) {
        this.state.isRunning = running;
    }

    /**
     * Check if OWO farming is enabled
     * @returns {boolean} Whether OWO farming is enabled
     */
    isOwoEnabled() {
        return this.state.isOwoEnabled;
    }

    /**
     * Set OWO farming enabled status
     * @param {boolean} enabled - Whether OWO farming should be enabled
     */
    setOwoEnabled(enabled) {
        this.state.isOwoEnabled = enabled;
    }

    /**
     * Toggle OWO farming enabled status
     * @returns {boolean} New enabled status
     */
    toggleOwoEnabled() {
        this.state.isOwoEnabled = !this.state.isOwoEnabled;
        return this.state.isOwoEnabled;
    }

    /**
     * Check if bot is sleeping
     * @returns {boolean} Whether bot is sleeping
     */
    isSleeping() {
        return this.state.isSleeping;
    }

    /**
     * Set bot sleeping status
     * @param {boolean} sleeping - Whether bot should be sleeping
     */
    setSleeping(sleeping) {
        this.state.isSleeping = sleeping;
    }

    /**
     * Check if OWO command is being processed
     * @returns {boolean} Whether OWO is being processed
     */
    isProcessingOwo() {
        return this.state.isProcessingOwo;
    }

    /**
     * Set OWO processing status
     * @param {boolean} processing - Whether OWO is being processed
     */
    setProcessingOwo(processing) {
        this.state.isProcessingOwo = processing;
    }

    /**
     * Check if WHWB command is being processed
     * @returns {boolean} Whether WHWB is being processed
     */
    isProcessingWhWb() {
        return this.state.isProcessingWhWb;
    }

    /**
     * Set WHWB processing status
     * @param {boolean} processing - Whether WHWB is being processed
     */
    setProcessingWhWb(processing) {
        this.state.isProcessingWhWb = processing;
    }

    /**
     * Get current channel index
     * @returns {number} Current channel index
     */
    getCurrentChannelIndex() {
        return this.state.currentChannelIndex;
    }

    /**
     * Set current channel index
     * @param {number} index - New channel index
     */
    setCurrentChannelIndex(index) {
        this.state.currentChannelIndex = index;
    }

    /**
     * Get channel IDs
     * @returns {string[]} Array of channel IDs
     */
    getChannelIds() {
        return [...this.state.channelIds];
    }

    /**
     * Set channel IDs
     * @param {string[]} channelIds - Array of channel IDs
     */
    setChannelIds(channelIds) {
        this.state.channelIds = [...channelIds];
    }

    /**
     * Get current channel ID
     * @returns {string|null} Current channel ID or null if none
     */
    getCurrentChannelId() {
        // Priority: temporary farm channel > rotation list
        if (this.state.tempFarmChannel) {
            return this.state.tempFarmChannel;
        }

        if (this.state.channelIds.length === 0) {
            return null;
        }

        return this.state.channelIds[this.state.currentChannelIndex];
    }

    /**
     * Advance to next channel in rotation
     * @returns {string|null} New channel ID or null if no channels
     */
    advanceToNextChannel() {
        if (this.state.channelIds.length === 0) {
            return null;
        }

        const oldChannelId = this.state.channelIds[this.state.currentChannelIndex];
        this.state.currentChannelIndex = (this.state.currentChannelIndex + 1) % this.state.channelIds.length;
        const newChannelId = this.state.channelIds[this.state.currentChannelIndex];

        return { oldChannelId, newChannelId };
    }

    /**
     * Get temporary farm channel
     * @returns {string|null} Temporary farm channel ID or null
     */
    getTempFarmChannel() {
        return this.state.tempFarmChannel;
    }

    /**
     * Set temporary farm channel
     * @param {string|null} channelId - Temporary farm channel ID or null to clear
     */
    setTempFarmChannel(channelId) {
        this.state.tempFarmChannel = channelId;
    }

    /**
     * Check if using temporary farm channel
     * @returns {boolean} Whether using temporary farm channel
     */
    isUsingTempFarm() {
        return this.state.tempFarmChannel !== null;
    }

    /**
     * Check if should cycle channels
     * @returns {boolean} Whether channels should be cycled
     */
    shouldCycleChannels() {
        // Don't cycle if using temporary farm or only one channel
        return !this.state.tempFarmChannel && this.state.channelIds.length > 1;
    }

    /**
     * Check if OWO loop should continue
     * @returns {boolean} Whether OWO loop should continue
     */
    shouldRunOwoLoop() {
        return this.state.isRunning &&
               this.state.isOwoEnabled &&
               !this.state.isSleeping &&
               !this.state.isProcessingWhWb;
    }

    /**
     * Check if WHWB loop should continue
     * @returns {boolean} Whether WHWB loop should continue
     */
    shouldRunWhWbLoop() {
        return this.state.isRunning &&
               this.state.isOwoEnabled &&
               !this.state.isSleeping &&
               !this.state.isProcessingOwo;
    }

    /**
     * Check if any loop should continue
     * @returns {boolean} Whether any loop should continue
     */
    shouldRunAnyLoop() {
        return this.state.isRunning && !this.state.isSleeping;
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    DEFAULT_FARMING_STATE,
    FarmingState
};
