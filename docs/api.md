# Discord Selfbot - API Documentation

## Overview

This document describes the API interfaces and key functions available in the Discord selfbot application.

## Core Modules

### State Management

#### StateManager

The central state management system.

```javascript
const { stateManager } = require('./core/state');

// Initialize state
stateManager.initialize(config);

// Get state snapshot
const snapshot = stateManager.getSnapshot();

// Reset all state
stateManager.resetAll();

// Stop bot
stateManager.stopBot(true);

// Resume bot
stateManager.resumeBot();

// Toggle state
const newValue = stateManager.toggleBooleanState('isOwoEnabled', 'OWO');

// Check if loop should run
const shouldRun = stateManager.shouldRunLoop('owo');

// Start emoji monitoring
stateManager.startEmojiMonitoring(channelId, botId, emojis);

// Stop emoji monitoring
stateManager.stopEmojiMonitoring();

// Get farming stats
const stats = stateManager.getFarmingStats();
```

#### FarmingState

Manages farming-related state.

```javascript
const { FarmingState } = require('./core/state/farmingState');

const farmingState = new FarmingState();

// Get state
const state = farmingState.getState();

// Set state
farmingState.setState({ isRunning: true });

// Check if running
const isRunning = farmingState.isRunning();

// Get current channel
const channelId = farmingState.getCurrentChannelId();

// Advance to next channel
const result = farmingState.advanceToNextChannel();

// Check if should cycle
const shouldCycle = farmingState.shouldCycleChannels();
```

#### CaptchaState

Manages CAPTCHA-related state.

```javascript
const { CaptchaState } = require('./core/state/captchaState');

const captchaState = new CaptchaState();

// Check if detected
const isDetected = captchaState.isDetected();

// Set detected
captchaState.setDetected(true);

// Check for CAPTCHA keywords
const hasCaptcha = captchaState.containsCaptchaKeywords(content);

// Get webhook messages
const messages = captchaState.getWebhookMessages();

// Add webhook message
captchaState.addWebhookMessage(message);

// Clear webhook delete timer
captchaState.clearWebhookDeleteTimer();
```

#### MonitoringState

Manages monitoring-related state.

```javascript
const { MonitoringState } = require('./core/state/monitoringState');

const monitoringState = new MonitoringState();

// Start emoji monitoring
monitoringState.startEmojiMonitoring(channelId, botId, emojis);

// Stop emoji monitoring
monitoringState.stopEmojiMonitoring();

// Get monitored emojis
const emojis = monitoringState.getMonitoredEmojis();

// Get timed channels
const channels = monitoringState.getTimedChannels();

// Set active timed farm
monitoringState.setActiveTimedFarm(data);
```

### Services

#### FarmingService

Handles farming operations.

```javascript
const { farmingService } = require('./services/farmingService');

// Get current channel
const channelId = farmingService.getCurrentChannelId();

// Send OWO command
const success = await farmingService.sendOwoCommand(client, channelId);

// Send WH/WB commands
const success = await farmingService.sendWhWbCommands(client, channelId);

// Perform random sleep
await farmingService.performRandomSleep();

// Get farming stats
const stats = farmingService.getStats();

// Get random loop delay
const delay = farmingService.getRandomLoopDelay();
```

#### CaptchaService

Handles CAPTCHA operations.

```javascript
const { captchaService } = require('./services/captchaService');

// Check for CAPTCHA keywords
const hasCaptcha = captchaService.containsCaptchaKeywords(content);

// Set CAPTCHA detected
captchaService.setDetected(true);

// Schedule webhook deletion
const timer = captchaService.scheduleWebhookDeletion(deleteFn);

// Get CAPTCHA stats
const stats = captchaService.getStats();
```

#### MonitoringService

Handles monitoring operations.

```javascript
const { monitoringService } = require('./services/monitoringService');

// Start emoji monitoring
monitoringService.startEmojiMonitoring(channelId, botId, emojis);

// Update monitoring channel
monitoringService.updateEmojiMonitoringChannel(newChannelId);

// Start timed farm
const timer = monitoringService.startTimedFarm(channelId, duration, onEnd);

// Get monitoring stats
const stats = monitoringService.getStats();
```

#### DiscordService

Handles Discord API interactions.

```javascript
const { getChannel, sendTyping, sendMessage } = require('./services/discordService');

// Get channel
const channel = await getChannel(client, channelId);

// Send typing indicator
await sendTyping(client, channelId);

// Send message
const message = await sendMessage(client, channelId, content);

// Clear all caches
clearAllCaches();
```

### Event System

#### EventBus

Core event bus implementation.

```javascript
const { EventBus } = require('./core/events/eventBus');

const eventBus = new EventBus();

// Register handler
const unregister = eventBus.on('event:type', (data) => {
    console.log('Event received:', data);
});

// Register one-time handler
eventBus.once('event:type', (data) => {
    console.log('One-time event:', data);
});

// Emit event
const results = await eventBus.emit('event:type', data);

// Emit synchronously
const results = eventBus.emitSync('event:type', data);

// Unregister handler
eventBus.off('event:type', handlerId);

// Get statistics
const stats = eventBus.getStats();
```

#### EventSystem

High-level event system interface.

```javascript
const { eventSystem, EventTypes } = require('./core/events');

// Emit farming events
await eventSystem.emitFarmingStarted(data);
await eventSystem.emitFarmingStopped(data);

// Emit CAPTCHA events
await eventSystem.emitCaptchaDetected(data);
await eventSystem.emitCaptchaSolved(data);

// Emit giveaway events
await eventSystem.emitGiveawayDetected(data);
await eventSystem.emitGiveawayJoined(data);

// Emit bot events
await eventSystem.emitBotReady(data);
await eventSystem.emitBotError(data);

// Get event history
const history = eventSystem.getHistory(10);
```

### Caching

#### CacheManager

General-purpose cache implementation.

```javascript
const { CacheManager } = require('./utils/cache/cacheManager');

const cache = new CacheManager({
    defaultTtl: 60000,
    maxSize: 1000,
    evictionStrategy: 'lru'
});

// Set value
cache.set('key', value, ttl);

// Get value
const value = cache.get('key');

// Check if exists
const exists = cache.has('key');

// Delete value
cache.delete('key');

// Get or set
const value = await cache.getOrSet('key', factory, ttl);

// Get statistics
const stats = cache.getStats();
```

#### ChannelCache

Specialized cache for Discord channels.

```javascript
const { globalChannelCache } = require('./utils/cache/channelCache');

// Get or fetch channel
const channel = await globalChannelCache.getOrFetchChannel(channelId, client);

// Get text channels
const textChannels = globalChannelCache.getTextChannels();

// Get channel statistics
const stats = globalChannelCache.getChannelStats();
```

### Async Operations

#### AsyncQueue

Async queue with concurrency control.

```javascript
const { AsyncQueue } = require('./utils/asyncQueue');

const queue = new AsyncQueue({
    concurrency: 5,
    maxSize: 100,
    timeout: 30000
});

// Add task
const result = await queue.add(async () => {
    // Task implementation
    return result;
});

// Pause queue
queue.pause();

// Resume queue
queue.resume();

// Get statistics
const stats = queue.getStats();
```

#### RateLimiter

Rate limiting with token bucket algorithm.

```javascript
const { RateLimiter } = require('./utils/rateLimiter');

const rateLimiter = new RateLimiter({
    capacity: 10,
    refillRate: 1,
    windowSize: 60000
});

// Check if allowed
const allowed = rateLimiter.isAllowed(key, count);

// Wait until allowed
const allowed = await rateLimiter.waitForAllowed(key, count, timeout);

// Get remaining tokens
const remaining = rateLimiter.getRemainingTokens(key);

// Get statistics
const stats = rateLimiter.getStats();
```

### Resource Management

#### ResourceManager

Central resource management.

```javascript
const { globalResourceManager } = require('./utils/managers/resourceManager');

// Get timeout manager
const timeoutManager = globalResourceManager.getTimeoutManager();

// Set timeout
timeoutManager.setTimeout('key', callback, delay);

// Clear timeout
timeoutManager.clearTimeout('key');

// Get event listener manager
const eventListenerManager = globalResourceManager.getEventListenerManager();

// Add listener
const remove = eventListenerManager.addListener(target, event, listener, key);

// Remove listener
eventListenerManager.removeListener(key, target, event, listener);

// Clear all resources
globalResourceManager.clearAll();

// Get statistics
const stats = globalResourceManager.getStats();
```

## Constants

### Application Constants

```javascript
const {
    TIME,
    DISCORD,
    FARMING,
    PROBABILITY,
    CACHE,
    PROCESS,
    GIVEAWAY,
    EMOJI_MONITORING,
    CAPTCHA,
    VALIDATION,
    LOGGING,
    ASYNC_QUEUE,
    RATE_LIMITING
} = require('./config/constants');
```

### Event Types

```javascript
const {
    EventTypes,
    EventPriority,
    EventCategories
} = require('./core/events');
```

## Type Definitions

Type definitions are available via JSDoc comments in `src/types/definitions.js`.

```javascript
/**
 * @typedef {Object} FarmingConfig
 * @property {string[]} channelIds - Array of channel IDs
 * @property {boolean} isOwoEnabled - Whether OWO farming is enabled
 */

/**
 * @typedef {Object} MessageData
 * @property {string} id - Message ID
 * @property {string} content - Message content
 * @property {Object} author - Message author
 */
```

## Error Handling

### Global Error Handlers

```javascript
const {
    handleUncaughtException,
    handleUnhandledRejection
} = require('./utils/errorHandler');

// These are automatically registered in index.js
```

### Logging

```javascript
const { Loggers } = require('./utils/logger');

// Module-specific loggers
Loggers.Farm.info('Farming started');
Loggers.Captcha.warn('CAPTCHA detected');
Loggers.Bot.error('Bot error');
Loggers.Main.debug('Debug message');
```

## Configuration

### ConfigManager

```javascript
const configManager = require('./config/manager');

// Load configuration
const config = await configManager.loadConfig();

// Get configuration
const config = configManager.getConfig();

// Get secure configuration (for logging)
const secureConfig = configManager.getSecureConfig();

// Validate configuration
const validation = configManager.validateConfig(config);

// Reload configuration
const config = await configManager.reloadConfig();
```

## Helper Functions

```javascript
const { getRandomInt, delay } = require('./utils/helpers');

// Get random integer
const random = getRandomInt(min, max);

// Delay execution
await delay(milliseconds);
```

## Process Communication

### Main Process

```javascript
// Send message to worker
workerProcess.send({
    type: 'message_type',
    data: payload
});

// Handle worker message
workerProcess.on('message', (message) => {
    // Handle message
});
```

### Worker Process

```javascript
// Send message to main process
process.send({
    type: 'message_type',
    data: payload
});

// Handle main process message
process.on('message', (message) => {
    // Handle message
});
```

## Best Practices

1. **Always use the state manager** instead of direct state access
2. **Use services** for business logic instead of direct API calls
3. **Handle errors** appropriately in all async operations
4. **Clean up resources** using the resource manager
5. **Use the event system** for cross-module communication
6. **Log appropriately** using the module-specific loggers
7. **Use constants** instead of magic numbers
8. **Type your functions** using JSDoc for better IDE support
9. **Test your changes** thoroughly before deploying
10. **Follow the existing code style** and conventions
