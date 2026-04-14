# AGENTS.md

## Architecture
Multi-process Discord selfbot. Main entry (`src/index.js`) spawns:
- Worker processes (`src/process/worker.js`) for each user token
- Notifier process (`src/process/notifier.js`) for Discord bot commands

Inter-process communication via `fork()` message passing.

## Commands
```bash
npm start              # Production: node src/index.js
npm run dev            # Development with nodemon
```

## Environment (`.env` required)
```env
TOKENS=token1,token2            # User tokens (comma-separated) - REQUIRED
DISCORD_BOT_TOKEN=xxx           # Bot token for notifier - optional
CHANNEL_IDS=id1,id2             # Farm channels (comma-separated)
TELEGRAM_BOT_TOKEN=xxx          # Telegram alerts - optional
TELEGRAM_CHAT_ID=xxx            # Paired with TELEGRAM_BOT_TOKEN
ENABLE_CONSOLE_LOG=false        # Logging toggle
```

## CI
Runs via GitHub Actions every 6 hours (`schedule: - cron: "0 */6 * * *"`).
Runtime limited to ~6 hours via `sleep 21300`.

## Key Modules
- `src/config/manager.js` - Config loading/validation (dotenv)
- `src/core/farming.js` - OWO/WHWB command loops
- `src/core/state.js` - Shared bot state
- `src/services/discordService.js` - Discord client wrapper

## Notes
- Uses `discord.js-selfbot-v13` (not standard `discord.js`)
- Child processes run with `--no-warnings` flag
- No tests or lint config present
- Minimum token length: 50 characters (validated at startup)
