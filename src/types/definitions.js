/**
 * Type Definitions Module
 *
 * Provides JSDoc type definitions for the application
 * to improve type safety and documentation.
 *
 * @module types/definitions
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * @typedef {Object} FarmingConfig
 * @property {string[]} channelIds - Array of channel IDs for farming
 * @property {boolean} isOwoEnabled - Whether OWO farming is enabled
 * @property {number} currentChannelIndex - Current channel index in rotation
 * @property {string|null} tempFarmChannel - Temporary farm channel ID
 */

/**
 * @typedef {Object} FarmingStats
 * @property {boolean} isRunning - Whether farming is running
 * @property {boolean} isOwoEnabled - Whether OWO farming is enabled
 * @property {boolean} isSleeping - Whether bot is sleeping
 * @property {boolean} isProcessingOwo - Whether OWO is being processed
 * @property {boolean} isProcessingWhWb - Whether WHWB is being processed
 * @property {string|null} currentChannel - Current channel ID
 * @property {number} channelCount - Number of channels
 * @property {string|null} tempFarmChannel - Temporary farm channel ID
 */

/**
 * @typedef {Object} CaptchaConfig
 * @property {boolean} captchaDetected - Whether CAPTCHA is detected
 * @property {boolean} isCaptchaDmHandlerEnabled - Whether CAPTCHA DM handler is enabled
 * @property {Array} captchaWebhookMessages - CAPTCHA webhook messages
 * @property {Timeout|null} captchaWebhookDeleteTimer - CAPTCHA webhook delete timer
 */

/**
 * @typedef {Object} MonitoringConfig
 * @property {boolean} monitoring - Whether channel monitoring is enabled
 * @property {boolean} emojiMonitoringEnabled - Whether emoji monitoring is enabled
 * @property {string|null} monitoredBotId - Bot ID to monitor
 * @property {string[]} monitoredEmojis - Emojis to monitor
 * @property {string|null} monitoredChannelId - Channel ID to monitor
 * @property {Object} timedChannels - Timed channels data
 * @property {Object} activeTimedFarm - Active timed farm data
 */

/**
 * @typedef {Object} UserConfig
 * @property {boolean} enableConsoleLog - Whether console logging is enabled
 * @property {Map<string, string[]>} userChannelLists - User-specific channel lists
 */

/**
 * @typedef {Object} BotState
 * @property {FarmingConfig} farming - Farming configuration
 * @property {CaptchaConfig} captcha - CAPTCHA configuration
 * @property {MonitoringConfig} monitoring - Monitoring configuration
 * @property {UserConfig} user - User configuration
 */

/**
 * @typedef {Object} AppConfig
 * @property {string[]} tokens - User tokens
 * @property {string|null} discordBotToken - Discord bot token
 * @property {string[]} CH_IDS - Channel IDs
 * @property {string[]} GIVEAWAY_CHANNEL_IDS - Giveaway channel IDs
 * @property {string} owo_ID - OWO bot ID
 * @property {string|null} telegramBotToken - Telegram bot token
 * @property {string|null} telegramChatId - Telegram chat ID
 * @property {boolean} enableConsoleLog - Whether console logging is enabled
 */

/**
 * @typedef {Object} MessageData
 * @property {string} id - Message ID
 * @property {string} content - Message content
 * @property {Object} author - Message author
 * @property {string} author.id - Author ID
 * @property {string} author.username - Author username
 * @property {Object} channel - Message channel
 * @property {string} channel.id - Channel ID
 * @property {string} channel.name - Channel name
 * @property {Object} guild - Message guild
 * @property {string} guild.id - Guild ID
 * @property {Array} components - Message components
 * @property {Object} reactions - Message reactions
 */

/**
 * @typedef {Object} CommandData
 * @property {string} command - Command name
 * @property {Object} user - User who executed command
 * @property {string} user.id - User ID
 * @property {string} user.username - User username
 * @property {Object} channel - Command channel
 * @property {string} channel.id - Channel ID
 * @property {Array} args - Command arguments
 */

/**
 * @typedef {Object} CaptchaData
 * @property {string} messageId - CAPTCHA message ID
 * @property {string} channelId - Channel ID
 * @property {string} content - Message content
 * @property {Object} author - Message author
 * @property {Date} timestamp - Message timestamp
 */

/**
 * @typedef {Object} GiveawayData
 * @property {string} messageId - Giveaway message ID
 * @property {string} channelId - Channel ID
 * @property {string} guildId - Guild ID
 * @property {string} emoji - Giveaway emoji
 * @property {string} type - Giveaway type (button or reaction)
 * @property {Date} endTime - Giveaway end time
 */

/**
 * @typedef {Object} EmojiData
 * @property {string} emoji - Emoji character
 * @property {string} type - Emoji type (reaction, content, or button)
 * @property {number} count - Reaction count (if reaction)
 * @property {string} label - Button label (if button)
 * @property {string} customId - Button custom ID (if button)
 */

/**
 * @typedef {Object} EventData
 * @property {string} type - Event type
 * @property {*} data - Event data
 * @property {Date} timestamp - Event timestamp
 */

/**
 * @typedef {Object} CacheStats
 * @property {number} size - Cache size
 * @property {number} maxSize - Maximum cache size
 * @property {number} hits - Cache hits
 * @property {number} misses - Cache misses
 * @property {string} hitRate - Hit rate percentage
 * @property {number} sets - Number of sets
 * @property {number} deletes - Number of deletes
 * @property {number} evictions - Number of evictions
 */

/**
 * @typedef {Object} QueueStats
 * @property {number} queueSize - Queue size
 * @property {number} running - Number of running operations
 * @property {number} concurrency - Concurrency limit
 * @property {number} maxSize - Maximum queue size
 * @property {number} added - Number of items added
 * @property {number} completed - Number of items completed
 * @property {number} failed - Number of items failed
 * @property {number} timedOut - Number of items timed out
 * @property {number} rejected - Number of items rejected
 * @property {string} successRate - Success rate percentage
 */

/**
 * @typedef {Object} RateLimiterStats
 * @property {number} totalRequests - Total requests
 * @property {number} allowedRequests - Allowed requests
 * @property {number} deniedRequests - Denied requests
 * @property {string} allowRate - Allow rate percentage
 * @property {number} globalTokens - Global token count
 * @property {number} globalCapacity - Global capacity
 * @property {number} perKeyBuckets - Number of per-key buckets
 * @property {Object} perKeyDenied - Per-key denial counts
 */

/**
 * @typedef {Object} EventBusStats
 * @property {number} eventsEmitted - Number of events emitted
 * @property {number} eventsHandled - Number of events handled
 * @property {number} handlersRegistered - Number of handlers registered
 * @property {number} handlersUnregistered - Number of handlers unregistered
 * @property {number} errors - Number of errors
 * @property {number} eventTypes - Number of event types
 * @property {number} totalHandlers - Total number of handlers
 * @property {boolean} paused - Whether event bus is paused
 * @property {number} historySize - Event history size
 */

/**
 * @typedef {Object} ResourceStats
 * @property {number} timeouts - Number of timeouts
 * @property {number} intervals - Number of intervals
 * @property {number} immediates - Number of immediates
 * @property {number} totalTimedOperations - Total timed operations
 * @property {number} listeners - Number of event listeners
 * @property {number} listenerKeys - Number of listener keys
 * @property {Object} listenersByTarget - Listeners by target
 * @property {Object} listenersByEvent - Listeners by event
 * @property {number} cleanupFunctions - Number of cleanup functions
 * @property {number} totalResources - Total resources
 */

/**
 * @typedef {Object} ServiceStats
 * @property {FarmingStats} farming - Farming statistics
 * @property {Object} captcha - CAPTCHA statistics
 * @property {Object} monitoring - Monitoring statistics
 * @property {CacheStats} cache - Cache statistics
 * @property {QueueStats} queue - Queue statistics
 * @property {RateLimiterStats} rateLimiter - Rate limiter statistics
 * @property {EventBusStats} eventBus - Event bus statistics
 * @property {ResourceStats} resources - Resource statistics
 */

/**
 * @typedef {Function} EventHandler
 * @param {*} data - Event data
 * @returns {Promise<*>|*} Handler result
 */

/**
 * @typedef {Object} EventHandlerOptions
 * @property {boolean} once - Whether handler should run only once
 * @property {number} priority - Handler priority
 * @property {string} id - Handler ID
 */

/**
 * @typedef {Object} CacheOptions
 * @property {number} defaultTtl - Default TTL in milliseconds
 * @property {number} maxSize - Maximum cache size
 * @property {string} evictionStrategy - Eviction strategy ('lru', 'lfu', 'fifo')
 * @property {number} cleanupIntervalMs - Cleanup interval in milliseconds
 */

/**
 * @typedef {Object} QueueOptions
 * @property {number} concurrency - Maximum concurrent operations
 * @property {number} maxSize - Maximum queue size
 * @property {number} timeout - Default timeout in milliseconds
 * @property {boolean} timeoutEnabled - Whether timeout is enabled
 */

/**
 * @typedef {Object} RateLimiterOptions
 * @property {number} capacity - Bucket capacity
 * @property {number} refillRate - Tokens per second
 * @property {number} windowSize - Sliding window size in milliseconds
 */

/**
 * @typedef {Object} DelayConfig
 * @property {number} min - Minimum delay in milliseconds
 * @property {number} max - Maximum delay in milliseconds
 */

/**
 * @typedef {Object} DelaysConfig
 * @property {DelayConfig} TYPING - Typing delay
 * @property {DelayConfig} MESSAGE - Message delay
 * @property {DelayConfig} OWO - OWO delay
 * @property {DelayConfig} WHWB - WHWB delay
 * @property {DelayConfig} SLEEP - Sleep duration
 * @property {DelayConfig} CHANNEL_CYCLE - Channel cycle delay
 * @property {DelayConfig} COMMAND_DELETE - Command delete delay
 * @property {number} STATUS_MESSAGE_DELETE - Status message delete delay
 * @property {number} INFO_MESSAGE_DELETE - Info message delete delay
 * @property {number} CAPTCHA_WEBHOOK_DELETE - CAPTCHA webhook delete delay
 */

/**
 * @typedef {Object} ProbabilitiesConfig
 * @property {number} SLEEP - Sleep probability
 * @property {number} TYPING - Typing probability
 */

/**
 * @typedef {Object} Client
 * @property {Object} user - Client user
 * @property {string} user.id - User ID
 * @property {string} user.username - User username
 * @property {Object} channels - Client channels
 * @property {Object} channels.cache - Channel cache
 * @property {Function} channels.fetch - Fetch channel function
 */

/**
 * @typedef {Object} Channel
 * @property {string} id - Channel ID
 * @property {string} name - Channel name
 * @property {string} type - Channel type
 * @property {Function} isText - Check if text channel
 * @property {Function} send - Send message function
 * @property {Function} sendTyping - Send typing indicator function
 * @property {Object} permissionsFor - Get permissions function
 * @property {Object} guild - Channel guild
 */

/**
 * @typedef {Object} Guild
 * @property {string} id - Guild ID
 * @property {string} name - Guild name
 * @property {Object} members - Guild members
 * @property {Object} members.me - Bot member
 * @property {Function} members.fetch - Fetch member function
 */

/**
 * @typedef {Object} Member
 * @property {string} id - Member ID
 * @property {string} username - Member username
 * @property {Object} permissions - Member permissions
 */

/**
 * @typedef {Object} MessageComponent
 * @property {number} type - Component type
 * @property {string} label - Component label
 * @property {string} customId - Component custom ID
 * @property {Object} emoji - Component emoji
 * @property {string} emoji.name - Emoji name
 * @property {string} emoji.id - Emoji ID
 */

/**
 * @typedef {Object} Message
 * @property {string} id - Message ID
 * @property {string} content - Message content
 * @property {Object} author - Message author
 * @property {Object} channel - Message channel
 * @property {Object} guild - Message guild
 * @property {Array} components - Message components
 * @property {Object} reactions - Message reactions
 * @property {Function} clickButton - Click button function
 * @property {Function} react - React function
 */

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    // Type definitions are provided as JSDoc comments
    // Import this module to get type hints in IDEs
};
