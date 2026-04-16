/**
 * Event Types Module
 *
 * Defines all event types used throughout the application.
 *
 * @module core/events/types
 */

// ============================================================================
// EVENT TYPES
// ============================================================================

/**
 * Event type definitions
 */
const EventTypes = {
    // ============================================================================
    // FARMING EVENTS
    // ============================================================================

    /** Farming started */
    FARMING_STARTED: 'farming:started',

    /** Farming stopped */
    FARMING_STOPPED: 'farming:stopped',

    /** Farming paused */
    FARMING_PAUSED: 'farming:paused',

    /** Farming resumed */
    FARMING_RESUMED: 'farming:resumed',

    /** OWO command sent */
    OWO_COMMAND_SENT: 'owo:command_sent',

    /** WH command sent */
    WH_COMMAND_SENT: 'wh:command_sent',

    /** WB command sent */
    WB_COMMAND_SENT: 'wb:command_sent',

    /** Channel changed */
    CHANNEL_CHANGED: 'farming:channel_changed',

    /** Sleep mode started */
    SLEEP_STARTED: 'farming:sleep_started',

    /** Sleep mode ended */
    SLEEP_ENDED: 'farming:sleep_ended',

    // ============================================================================
    // CAPTCHA EVENTS
    // ============================================================================

    /** CAPTCHA detected */
    CAPTCHA_DETECTED: 'captcha:detected',

    /** CAPTCHA solved */
    CAPTCHA_SOLVED: 'captcha:solved',

    /** CAPTCHA webhook message created */
    CAPTCHA_WEBHOOK_CREATED: 'captcha:webhook_created',

    /** CAPTCHA webhook message deleted */
    CAPTCHA_WEBHOOK_DELETED: 'captcha:webhook_deleted',

    // ============================================================================
    // MONITORING EVENTS
    // ============================================================================

    /** Channel monitoring started */
    CHANNEL_MONITORING_STARTED: 'monitoring:channel_started',

    /** Channel monitoring stopped */
    CHANNEL_MONITORING_STOPPED: 'monitoring:channel_stopped',

    /** Emoji monitoring started */
    EMOJI_MONITORING_STARTED: 'monitoring:emoji_started',

    /** Emoji monitoring stopped */
    EMOJI_MONITORING_STOPPED: 'monitoring:emoji_stopped',

    /** Emoji detected */
    EMOJI_DETECTED: 'monitoring:emoji_detected',

    /** Timed farm started */
    TIMED_FARM_STARTED: 'monitoring:timed_farm_started',

    /** Timed farm ended */
    TIMED_FARM_ENDED: 'monitoring:timed_farm_ended',

    // ============================================================================
    // GIVEAWAY EVENTS
    // ============================================================================

    /** Giveaway detected */
    GIVEAWAY_DETECTED: 'giveaway:detected',

    /** Giveaway joined */
    GIVEAWAY_JOINED: 'giveaway:joined',

    /** Giveaway failed to join */
    GIVEAWAY_FAILED: 'giveaway:failed',

    // ============================================================================
    // DISCORD EVENTS
    // ============================================================================

    /** Message received */
    MESSAGE_RECEIVED: 'discord:message_received',

    /** Message sent */
    MESSAGE_SENT: 'discord:message_sent',

    /** Reaction added */
    REACTION_ADDED: 'discord:reaction_added',

    /** Reaction removed */
    REACTION_REMOVED: 'discord:reaction_removed',

    /** Button clicked */
    BUTTON_CLICKED: 'discord:button_clicked',

    /** Typing started */
    TYPING_STARTED: 'discord:typing_started',

    // ============================================================================
    // SYSTEM EVENTS
    // ============================================================================

    /** Bot ready */
    BOT_READY: 'system:bot_ready',

    /** Bot disconnected */
    BOT_DISCONNECTED: 'system:bot_disconnected',

    /** Bot error */
    BOT_ERROR: 'system:bot_error',

    /** Process started */
    PROCESS_STARTED: 'system:process_started',

    /** Process stopped */
    PROCESS_STOPPED: 'system:process_stopped',

    /** Configuration changed */
    CONFIG_CHANGED: 'system:config_changed',

    /** State changed */
    STATE_CHANGED: 'system:state_changed',

    // ============================================================================
    // WORKER EVENTS
    // ============================================================================

    /** Worker ready */
    WORKER_READY: 'worker:ready',

    /** Worker message received */
    WORKER_MESSAGE: 'worker:message',

    /** Worker error */
    WORKER_ERROR: 'worker:error',

    /** Worker exited */
    WORKER_EXITED: 'worker:exited',

    // ============================================================================
    // NOTIFIER EVENTS
    // ============================================================================

    /** Notifier ready */
    NOTIFIER_READY: 'notifier:ready',

    /** Notifier message received */
    NOTIFIER_MESSAGE: 'notifier:message',

    /** Notifier error */
    NOTIFIER_ERROR: 'notifier:error',

    /** Command received */
    COMMAND_RECEIVED: 'notifier:command',

    /** Command result */
    COMMAND_RESULT: 'notifier:command_result'
};

// ============================================================================
// EVENT PRIORITY LEVELS
// ============================================================================

/**
 * Event priority levels
 */
const EventPriority = {
    /** Critical events - highest priority */
    CRITICAL: 0,

    /** High priority events */
    HIGH: 1,

    /** Normal priority events */
    NORMAL: 2,

    /** Low priority events */
    LOW: 3,

    /** Background events - lowest priority */
    BACKGROUND: 4
};

// ============================================================================
// EVENT CATEGORIES
// ============================================================================

/**
 * Event categories for organization
 */
const EventCategories = {
    /** Farming related events */
    FARMING: 'farming',

    /** CAPTCHA related events */
    CAPTCHA: 'captcha',

    /** Monitoring related events */
    MONITORING: 'monitoring',

    /** Giveaway related events */
    GIVEAWAY: 'giveaway',

    /** Discord related events */
    DISCORD: 'discord',

    /** System related events */
    SYSTEM: 'system',

    /** Worker related events */
    WORKER: 'worker',

    /** Notifier related events */
    NOTIFIER: 'notifier'
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    EventTypes,
    EventPriority,
    EventCategories
};
