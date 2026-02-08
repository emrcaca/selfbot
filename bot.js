const {
  Client,
  GatewayIntentBits,
  REST,
  Partials,
  Routes,
  MessageFlags,
  DefaultWebSocketManagerOptions,
  Message,
  DiscordjsError,
  ErrorCodes
} = require('discord.js');

const { handleUncaughtException, handleUnhandledRejection } = require('./modules/utils/errorHandler');
const { clearAllTrackedTimeouts } = require('./modules/services/discordService');
const { Loggers } = require('./modules/utils/logger');
const { interactionHandlers, authorizedUserIds, captchaDmMessages, isOwoEnabled } = require('./modules/bot/state');
const { commands, sendV2Reply, handleSelfbotCommand, handleChannelsCommand, handleFarmButtonClick } = require('./modules/bot/commands');
const { sendChannelMonitorAlert, handleCaptchaNotification, handleCaptchaSolved, cleanupOldAlertMessagesForUser } = require('./modules/bot/captchaHandler');

// Configure Discord client
DefaultWebSocketManagerOptions.identifyProperties.browser = 'Discord iOS';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// Set up global error handlers
process.on('uncaughtException', handleUncaughtException);
process.on('unhandledRejection', handleUnhandledRejection);

// Extend Message prototype with forward method
Message.prototype.forward = function (channel) {
  const resolvedChannel = this.client.channels.resolve(channel);
  if (!resolvedChannel) {
    throw new DiscordjsError(ErrorCodes.InvalidType, 'channel', 'TextBasedChannelResolvable');
  }
  return resolvedChannel.send({
    forward: {
      message: this.id,
      channel: this.channelId,
      guild: this.guildId,
    },
    flags: MessageFlags.IsComponentsV2
  });
};

/**
 * Handle IPC messages from parent process
 */
process.on('message', (message) => {
  Loggers.Bot.debug('Process message received:', message.type);

  switch (message.type) {
    case 'komut_sonucu':
      handleCommandResult(message);
      break;

    case 'selfbot_ready':
      handleSelfbotReady(message);
      break;

    case 'captcha':
      Loggers.Bot.info('CAPTCHA notification received');
      handleCaptchaNotification(client, message, captchaDmMessages);
      break;

    case 'captcha_solved':
      Loggers.Bot.info('CAPTCHA solved notification received');
      handleCaptchaSolved(client, message.userId, captchaDmMessages);
      break;

    case 'channel_monitor_alert':
      sendChannelMonitorAlert(client, message);
      break;

    case 'owo_status_update':
      isOwoEnabled = message.isOwoEnabled;
      Loggers.Bot.debug('OWO status updated:', isOwoEnabled);
      break;

    default:
      Loggers.Bot.debug('Unknown message type:', message.type);
  }
});

/**
 * Handle command result from selfbot
 * @param {Object} message - Command result message
 */
function handleCommandResult(message) {
  const handler = interactionHandlers.get(message.interactionId);
  if (handler) {
    handler({ resultMessage: message.resultMessage, isOwoEnabled: message.isOwoEnabled });
    interactionHandlers.delete(message.interactionId);
  }
}

/**
 * Handle selfbot ready event
 * @param {Object} message - Ready message
 */
function handleSelfbotReady(message) {
  authorizedUserIds.add(message.userId);
  cleanupOldAlertMessagesForUser(client, message.userId);
  Loggers.Bot.info(`Selfbot ready (User ID: ${message.userId})`);
}

/**
 * Register slash commands
 * @returns {Promise<void>}
 */
async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    Loggers.Bot.info('Slash commands registered successfully');
  } catch (error) {
    Loggers.Bot.error('Error registering slash commands:', error);
  }
}

// Client ready event
client.once('clientReady', async () => {
  Loggers.Bot.info('Discord bot started:', client.user.tag);
  await registerCommands();
});

// Interaction create event
client.on('interactionCreate', async interaction => {
  // Check authorization
  if (!authorizedUserIds.has(interaction.user.id)) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    return await sendV2Reply(interaction, '### Bu komutu kullanma yetkiniz yok.');
  }

  try {
    if (interaction.isChatInputCommand()) {
      await handleChatInputCommand(interaction);
    } else if (interaction.isButton()) {
      await handleButtonInteraction(interaction);
    }
  } catch (error) {
    Loggers.Bot.error('Error processing interaction:', error);
    try {
      await sendV2Reply(interaction, '### Komut işlenirken bir hata oluştu.');
    } catch (e) {
      Loggers.Bot.error('Error sending error message:', e);
    }
  }
});

/**
 * Handle chat input command interactions
 * @param {Interaction} interaction - Discord interaction
 * @returns {Promise<void>}
 */
async function handleChatInputCommand(interaction) {
  switch (interaction.commandName) {
    case 'selfbot':
      const commandType = interaction.options.getString('komut');
      await handleSelfbotCommand(interaction, commandType, interactionHandlers);
      break;

    case 'channels':
      const action = interaction.options.getString('action');
      const channelIdsString = interaction.options.getString('channel_ids');
      await handleChannelsCommand(interaction, action, channelIdsString, interactionHandlers);
      break;

    default:
      Loggers.Bot.warn('Unknown command:', interaction.commandName);
  }
}

/**
 * Handle button interactions
 * @param {Interaction} interaction - Discord interaction
 * @returns {Promise<void>}
 */
async function handleButtonInteraction(interaction) {
  switch (interaction.customId) {
    case 'dismiss_alert':
      await interaction.deferUpdate();
      await interaction.message.delete().catch(err => {
        Loggers.Bot.error('Error dismissing alert:', err);
      });
      break;

    case 'farm_this_channel':
      await handleFarmButtonClick(interaction, 'this_channel', interactionHandlers);
      break;

    case 'farm_permanent_channels':
      await handleFarmButtonClick(interaction, 'permanent_channels', interactionHandlers);
      break;

    default:
      Loggers.Bot.warn('Unknown button ID:', interaction.customId);
  }
}

// Message create event (reserved for future use)
client.on('messageCreate', async message => {
  // Future message handling logic can be added here
});

// Exit event
process.on('exit', (code) => {
  Loggers.Bot.info(`Process exiting with code: ${code}`);
  clearAllTrackedTimeouts();
  client.destroy();
});

// Login to Discord
Loggers.Bot.info('Logging into Discord...');
client.login(process.env.BOT_TOKEN).catch(error => {
  Loggers.Bot.error('Discord login error:', error);
  process.exit(1);
});