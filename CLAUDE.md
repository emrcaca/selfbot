# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Discord selfbot automation suite that manages multiple Discord user accounts for farming operations (OWO, WHWB commands). The architecture uses isolated child processes for each selfbot account and a centralized notifier bot for control and notifications.

## Architecture

### Process Architecture

The application uses a multi-process architecture for isolation and scalability:

- **Main Process** (`src/index.js`): Orchestrates all child processes, handles inter-process communication
- **Worker Processes** (`src/process/worker.js`): One per Discord user token, handles actual selfbot operations
- **Notifier Process** (`src/process/notifier.js`): Discord bot that provides control interface and notifications

### Inter-Process Communication

Processes communicate via Node.js `process.send()` and `process.on('message')`:

- Main → Worker: Commands (`komut_kullanildi`, `channels_command`, `setch_command`)
- Worker → Main: Results (`komut_sonucu`), status updates (`owo_status_update`, `farm_status_update`), alerts (`captcha`, `channel_monitor_alert`)
- Main → Notifier: Forwarded messages from workers
- Notifier → Main: Command requests to forward to specific workers

### Core Modules

- **`src/config/manager.js`**: Singleton that loads and validates configuration from `.env` file
- **`src/core/state.js`**: Centralized state management (bot status, channels, CAPTCHA detection, timing)
- **`src/core/farming.js`**: Farming loop logic (OWO, WHWB, channel cycling)
- **`src/handlers/messageHandler.js`**: Message and CAPTCHA DM handling
- **`src/services/discordService.js`**: Discord API utilities and timeout tracking
- **`src/services/telegramService.js`**: Telegram notification integration
- **`src/utils/logger.js`**: Logging utilities with conditional console output

### State Management

The `botState` object in `src/core/state.js` is the single source of truth for:
- Farming status (`isRunning`, `isOwoEnabled`, `isSleeping`)
- CAPTCHA detection (`captchaDetected`)
- Channel management (`channelIds`, `currentChannelIndex`, `tempFarmChannel`)
- User-specific channel lists (`userChannelLists` Map)

## Development Commands

```bash
# Start the application
npm start

# Development mode with auto-restart
npm run dev

# Install dependencies
npm install
```

## Configuration

Configuration is loaded from `.env` file:

```env
TOKENS="token1,token2,token3"           # User tokens (comma-separated)
DISCORD_BOT_TOKEN="bot_token"           # Notifier bot token
CHANNEL_IDS="id1,id2,id3"               # Farming channels
OWO_ID="408785106942164992"            # OWO bot ID
TELEGRAM_BOT_TOKEN=""                   # Optional Telegram bot
TELEGRAM_CHAT_ID=""                     # Optional Telegram chat ID
ENABLE_CONSOLE_LOG=true                 # Enable detailed logging
DEFAULT_PRESENCE="invisible"            # Discord presence status
```

## Key Patterns

### Farming Loops

Farming operations use async loops with random delays to appear natural:
- `owoLoop()`: Sends OWO commands with 10.5-13.5s delays
- `whwbLoop()`: Sends WHWB commands with 12.5-15s delays
- `cycleChannels()`: Rotates through channels every 10-15 minutes

### CAPTCHA Detection

CAPTCHA keywords are defined in `src/core/state.js`:
- When detected, bot stops immediately and sends notification via notifier
- CAPTCHA DM handler allows manual resolution via `!sil` command

### Channel Management

Two types of farming:
1. **Temporary Farm**: Single channel with 10-minute limit (`tempFarmChannel`)
2. **Permanent Farm**: Rotates through all channels in list (`channelIds`)

User-specific channel lists can be set via `/setch` command.

### Error Handling

Global error handlers are registered in each process:
- `uncaughtException` and `unhandledRejection` handlers in `src/utils/errorHandler.js`
- Graceful shutdown on SIGINT/SIGTERM

## Important Notes

- This is a selfbot (user account automation), which violates Discord ToS
- Uses `discord.js-selfbot-v13` for user account operations
- Uses standard `discord.js` for the notifier bot
- All processes use `NODE_TLS_REJECT_UNAUTHORIZED='0'` for certificate issues
- Interaction responses are tracked for 20 seconds to prevent duplicates
