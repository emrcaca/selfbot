# Discord Selfbot - Architecture Documentation

## Overview

This Discord selfbot application is designed to automate farming operations on Discord servers, specifically for the OWO bot. The application uses a multi-process architecture with a main process coordinating multiple worker processes and a notifier bot.

## Architecture

### Process Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Main Process                          │
│  (index.js)                                                   │
│  - Manages worker processes                                   │
│  - Manages notifier process                                   │
│  - Handles inter-process communication                        │
│  - Coordinates startup and shutdown                           │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Worker Process │  │  Worker Process │  │  Worker Process │
│  (worker.js)     │  │  (worker.js)     │  │  (worker.js)     │
│  - Selfbot logic │  │  - Selfbot logic │  │  - Selfbot logic │
│  - Farming       │  │  - Farming       │  │  - Farming       │
│  - Giveaways     │  │  - Giveaways     │  │  - Giveaways     │
│  - Monitoring    │  │  - Monitoring    │  │  - Monitoring    │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │                    │                    │
         └────────────────────┴────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Notifier Process│
                    │  (notifier.js)  │
                    │  - Discord bot   │
                    │  - Commands      │
                    │  - Notifications │
                    └─────────────────┘
```

### Module Structure

```
src/
├── config/              # Configuration management
│   ├── constants.js     # Application constants
│   └── manager.js       # Configuration loader and validator
├── core/                # Core functionality
│   ├── events/          # Event system
│   │   ├── types.js     # Event type definitions
│   │   ├── eventBus.js  # Event bus implementation
│   │   └── index.js     # Event system exports
│   ├── farming.js       # Farming operations
│   └── state/           # State management
│       ├── index.js     # State manager
│       ├── farmingState.js
│       ├── captchaState.js
│       ├── monitoringState.js
│       └── userState.js
├── handlers/            # Event handlers
│   ├── giveawayHandler.js
│   ├── emojiMonitorHandler.js
│   └── messageHandler.js
├── process/             # Process implementations
│   ├── worker.js        # Worker process
│   └── notifier.js      # Notifier process
├── services/            # Business logic services
│   ├── discordService.js
│   ├── farmingService.js
│   ├── captchaService.js
│   ├── monitoringService.js
│   ├── telegramService.js
│   └── openaiService.js
├── utils/               # Utility functions
│   ├── cache/           # Caching utilities
│   │   ├── cacheManager.js
│   │   └── channelCache.js
│   ├── managers/        # Resource managers
│   │   ├── timeoutManager.js
│   │   ├── eventListenerManager.js
│   │   └── resourceManager.js
│   ├── asyncQueue.js    # Async queue implementation
│   ├── rateLimiter.js  # Rate limiting
│   ├── helpers.js       # Helper functions
│   ├── errorHandler.js  # Error handling
│   └── logger.js        # Logging
├── types/               # Type definitions
│   └── definitions.js   # JSDoc type definitions
└── index.js             # Application entry point
```

## Key Components

### State Management

The application uses a modular state management system with separate managers for different concerns:

- **FarmingState**: Manages farming operations, channel management, and sleep mode
- **CaptchaState**: Manages CAPTCHA detection and handling
- **MonitoringState**: Manages channel and emoji monitoring
- **UserState**: Manages user-specific settings and channel lists

All state is managed through a central `StateManager` class that provides a unified interface.

### Event System

The event system provides a centralized way to handle application events:

- **EventBus**: Core event bus with priority-based handler execution
- **EventTypes**: Predefined event types for common operations
- **EventSystem**: High-level interface for event management

### Resource Management

Resource managers prevent memory leaks by tracking and cleaning up:

- **TimeoutManager**: Tracks and cleans up timeouts and intervals
- **EventListenerManager**: Tracks and cleans up event listeners
- **ResourceManager**: Central resource management coordinator

### Caching

The caching system provides efficient data storage with TTL support:

- **CacheManager**: General-purpose cache with multiple eviction strategies
- **ChannelCache**: Specialized cache for Discord channels

### Async Operations

Async operations are managed through:

- **AsyncQueue**: Queue system with configurable concurrency
- **RateLimiter**: Token bucket algorithm for rate limiting

## Data Flow

### Farming Flow

```
User Command → Notifier → Worker → Farming Service → Discord API
     ↓              ↓          ↓            ↓              ↓
  Response    Forward   Execute    Send Command   Receive Response
```

### Event Flow

```
Event Source → Event Bus → Event Handlers → State Updates → Actions
     ↓              ↓            ↓               ↓            ↓
  Discord      Emit      Execute      Update State   Execute
  API         Events    Handlers     & Services   Commands
```

### CAPTCHA Detection Flow

```
Message → CAPTCHA Keywords Check → CAPTCHA Detected → Stop Farming
   ↓              ↓                      ↓                ↓
Content    Contains Keywords?    Set CAPTCHA Flag   Pause Operations
```

## Configuration

Configuration is loaded from environment variables through the `ConfigManager`:

- **TOKENS**: Comma-separated list of user tokens
- **DISCORD_BOT_TOKEN**: Discord bot token for notifier
- **CHANNEL_IDS**: Comma-separated list of channel IDs for farming
- **GIVEAWAY_CHANNEL_IDS**: Comma-separated list of giveaway channel IDs
- **OWO_ID**: OWO bot ID
- **TELEGRAM_BOT_TOKEN**: Telegram bot token (optional)
- **TELEGRAM_CHAT_ID**: Telegram chat ID (optional)
- **ENABLE_CONSOLE_LOG**: Enable console logging

## Security Considerations

1. **Token Security**: All tokens are loaded from environment variables and never logged
2. **Rate Limiting**: Built-in rate limiting prevents API abuse
3. **CAPTCHA Detection**: Automatic CAPTCHA detection prevents account issues
4. **Resource Cleanup**: Automatic cleanup prevents memory leaks

## Performance Optimizations

1. **Caching**: Channel caching reduces API calls
2. **Async Queue**: Controlled concurrency prevents overwhelming the API
3. **Rate Limiting**: Token bucket algorithm ensures compliance with rate limits
4. **Resource Management**: Automatic cleanup prevents memory leaks
5. **Event System**: Efficient event handling with priority-based execution

## Error Handling

The application has comprehensive error handling:

- **Global Error Handlers**: Catch uncaught exceptions and rejections
- **Service-Level Error Handling**: Each service handles its own errors
- **Error Logging**: All errors are logged with context
- **Graceful Degradation**: Errors don't crash the entire application

## Monitoring and Observability

The application provides extensive monitoring:

- **Logging**: Structured logging with multiple levels
- **Statistics**: Comprehensive statistics for all major components
- **Event History**: Track recent events for debugging
- **Resource Tracking**: Monitor resource usage

## Extensibility

The application is designed for extensibility:

- **Modular Architecture**: Easy to add new modules
- **Event System**: Easy to add new event handlers
- **Service Layer**: Easy to add new services
- **Plugin System**: Support for custom plugins

## Testing Considerations

When testing the application:

1. **Isolation**: Test each module independently
2. **Mocking**: Mock external dependencies (Discord API, etc.)
3. **State Management**: Test state transitions
4. **Event Handling**: Test event emission and handling
5. **Resource Cleanup**: Verify proper cleanup

## Deployment

The application is designed for deployment:

- **Environment Variables**: All configuration via environment variables
- **Process Management**: Suitable for PM2 or similar process managers
- **Logging**: Structured logging for log aggregation
- **Error Handling**: Comprehensive error handling for stability
