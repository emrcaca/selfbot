const {
    Client,
    GatewayIntentBits,
    REST,
    Partials,
    Routes,
    ApplicationCommandOptionType,
    Message,
    DiscordjsError,
    ErrorCodes,
    MessageFlags
} = require('discord.js');

const UIBuilder = require('../utils/uiBuilder');
const configManager = require('../config/manager');
const { handleUncaughtException, handleUnhandledRejection } = require('../utils/errorHandler');
const { TIMEOUTS, MESSAGE_LIMITS } = require('../constants/timeouts');
const IPCMessageBuilder = require('../utils/ipcMessageBuilder');

// Load Telegram config for notifications
let telegramConfig = null;
async function loadTelegramConfig() {
    try {
        const config = await configManager.loadConfig();
        telegramConfig = {
            botToken: config.telegramBotToken,
            chatId: config.telegramChatId
        };
        console.log('✅ Telegram config loaded for Notifier');
    } catch (error) {
        console.warn('⚠️ Failed to load Telegram config:', error.message);
    }
}

// Security Check
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

/**
 * Main Notifier Bot Class
 * Handles interactions via Discord Bot API
 */
class NotifierBot {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.DirectMessages,
                GatewayIntentBits.MessageContent,
            ],
            partials: [Partials.Message, Partials.Channel, Partials.Reaction],
        });

        this.interactionHandlers = new Map();
        this.authorizedUserIds = new Set();
        this.captchaDmMessages = new Map();
        
        this._setupEventHandlers();
        this._patchDiscordJs();
    }

    _patchDiscordJs() {
        // Custom forward implementation
        Message.prototype.forward = function (channel) {
            const resolvedChannel = this.client.channels.resolve(channel);
            if (!resolvedChannel) throw new DiscordjsError(ErrorCodes.InvalidType, 'channel', 'TextBasedChannelResolvable');
            return resolvedChannel.send({
                forward: {
                    message: this.id,
                    channel: this.channelId,
                    guild: this.guildId,
                },
                flags: MessageFlags.IsComponentsV2
            });
        };
    }

    _setupEventHandlers() {
        process.on('uncaughtException', handleUncaughtException);
        process.on('unhandledRejection', handleUnhandledRejection);

        this.client.once('clientReady', () => this._onReady());
        this.client.on('interactionCreate', (i) => this._onInteraction(i));
        this.client.on('messageCreate', (msg) => this._onMessageCreate(msg));

        process.on('message', (msg) => this._handleIPCMessage(msg));
        process.on('SIGINT', () => this.shutdown());
        process.on('SIGTERM', () => this.shutdown());
    }

    async _onMessageCreate(message) {
        // Sadece DM mesajlarını kontrol et
        if (!message.inGuild() && message.content.trim() === '!sil') {
            // Sadece yetkili kullanıcılar (authorized user IDs)
            if (this.authorizedUserIds.has(message.author.id)) {
                await this._handleSilCommand(message);
            }
        }
    }

    /**
     * Send a temporary message that auto-deletes after a delay
     * @param {TextBasedChannel} channel - Channel to send message to
     * @param {string} content - Message content
     * @param {number} timeoutMs - Auto-delete timeout in milliseconds
     * @returns {Promise<Message|null>} Sent message or null if failed
     * @private
     */
    async _sendTempMessage(channel, content, timeoutMs = TIMEOUTS.TEMP_MESSAGE_DELETE) {
        try {
            const sent = await channel.send({ content, ephemeral: false });
            setTimeout(() => sent.delete().catch(() => {}), timeoutMs);
            return sent;
        } catch (error) {
            return null;
        }
    }

    async _handleSilCommand(message) {
        try {
            // Son 100 mesajı al
            const messages = await message.channel.messages.fetch({ limit: MESSAGE_LIMITS.CLEANUP_FETCH_LIMIT });

            // Sadece bot tarafından gönderilen mesajları filtrele (ephemeral hariç)
            const botMessages = messages.filter(msg =>
                msg.author.id === this.client.user.id && !msg.flags.Ephemeral
            );

            if (botMessages.size > 0) {
                // Mesajları sırayla sil
                await Promise.all(botMessages.map(msg => msg.delete().catch(() => {})));
                await this._sendTempMessage(message.channel, `✅ ${botMessages.size} bot mesajı silindi.`);
            } else {
                await this._sendTempMessage(message.channel, 'ℹ️ Silinecek bot mesajı bulunamadı.');
            }
        } catch (error) {
            console.error('❌ !sil command error:', error);
            await this._sendTempMessage(message.channel, '❌ Mesajlar silinirken bir hata oluştu.');
        }
    }

    async start(token) {
        try {
            // Load Telegram config before login
            await loadTelegramConfig();
            await this.client.login(token);
        } catch (error) {
            console.error('❌ Notifier Login Error:', error.message);
            process.exit(1);
        }
    }
    
    shutdown() {
        console.log('Stopping Notifier Bot...');
        this.client.destroy();
        process.exit(0);
    }

    async _onReady() {
        console.log(`🤖 Notifier Bot Ready: ${this.client.user.tag}`);
        await this._registerCommands();
    }

    async _registerCommands() {
        const commands = [
            {
                name: 'selfbot',
                description: 'Selfbotu kontrol et.',
                options: [
                    {
                        name: 'komut',
                        description: 'Çalıştırılacak komut',
                        type: ApplicationCommandOptionType.String,
                        required: true,
                        choices: [{ name: 'Farm', value: 'farm' }],
                    }
                ],
            },
            {
                name: 'channels',
                description: 'Kalıcı kanal listesini yönet.',
                options: [
                    {
                        name: 'action',
                        description: 'Yapılacak işlem',
                        type: ApplicationCommandOptionType.String,
                        required: true,
                        choices: [
                            { name: 'Add', value: 'add' },
                            { name: 'Clear', value: 'clear' }
                        ]
                    },
                    {
                        name: 'channel_ids',
                        description: 'Eklenecek kanal ID\'leri',
                        type: ApplicationCommandOptionType.String,
                        required: false
                    }
                ]
            }
        ];

        const rest = new REST({ version: '10' }).setToken(this.client.token);
        try {
            await rest.put(Routes.applicationCommands(this.client.user.id), { body: commands });
            console.log('✅ Slash commands registered');
        } catch (error) {
            console.error('❌ Slash command registration failed:', error);
        }
    }

    // --- IPC Message Handling ---

    async _handleIPCMessage(msg) {
        console.log('📨 IPC Message Received:', msg.type);
        
        try {
            switch (msg.type) {
                case 'komut_sonucu':
                    this._handleCommandResult(msg);
                    break;
                case 'selfbot_ready':
                    this.authorizedUserIds.add(msg.userId);
                    break;
                case 'captcha':
                    await this._handleCaptchaNotification(msg);
                    break;
                case 'captcha_solved':
                    await this._handleCaptchaSolved(msg.userId);
                    break;
                case 'channel_monitor_alert':
                    await this._handleMonitorAlert(msg);
                    break;
            }
        } catch (error) {
            console.error('❌ IPC Handler Error:', error);
        }
    }

    _handleCommandResult(msg) {
        if (!msg.interactionId) return;
        const handler = this.interactionHandlers.get(msg.interactionId);
        if (handler) {
            handler({ resultMessage: msg.resultMessage, isOwoEnabled: msg.isOwoEnabled });
            this.interactionHandlers.delete(msg.interactionId);
        }
    }

    async _handleMonitorAlert(msg) {
        try {
            const user = await this.client.users.fetch(msg.userId);
            const dm = await user.createDM();
            
            const messageData = UIBuilder.createAlertMessage(msg.channelId, msg.author, msg.content);
            await dm.send(messageData);
        } catch (error) {
            console.error('❌ Monitor Alert Error:', error);
        }
    }

    /**
     * Fetch user and create DM channel
     * @param {string} userId - User ID to fetch
     * @returns {Promise<DMChannel>} DM channel for the user
     * @private
     */
    async _fetchUserDM(userId) {
        const user = await this.client.users.fetch(userId);
        return await user.createDM();
    }

    /**
     * Try to forward the original CAPTCHA message to DM
     * @param {Object} msg - IPC message containing guild/channel/message IDs
     * @param {DMChannel} dmChannel - DM channel to forward to
     * @returns {Promise<boolean>} Whether message was successfully forwarded
     * @private
     */
    async _tryForwardOriginalMessage(msg, dmChannel) {
        const { userId, messageId, channelId, guildId } = msg;

        if (!guildId || !channelId || !messageId) {
            return false;
        }

        try {
            const guild = await this.client.guilds.fetch(guildId);
            const channel = await guild.channels.fetch(channelId);
            const message = await channel.messages.fetch(messageId);

            const sent = await message.forward(dmChannel);
            this._trackCaptchaMessage(userId, sent.id, dmChannel);
            return true;
        } catch (error) {
            console.warn('⚠️ Could not forward original CAPTCHA message:', error.message);
            return false;
        }
    }

    /**
     * Send fallback CAPTCHA message when original cannot be forwarded
     * @param {string} userId - User ID
     * @param {DMChannel} dmChannel - DM channel to send to
     * @private
     */
    async _sendFallbackCaptchaMessage(userId, dmChannel) {
        const sent = await dmChannel.send({
            content: '⚠️ **CAPTCHA Detected**\nPlease solve it manually. Original message could not be forwarded.'
        });
        this._trackCaptchaMessage(userId, sent.id, dmChannel);
    }

    async _handleCaptchaNotification(msg) {
        console.log('🔍 Processing CAPTCHA notification...');
        const { userId } = msg;

        try {
            const dmChannel = await this._fetchUserDM(userId);

            // Send to Telegram
            await this._sendTelegramNotification(msg);

            // Try to forward original message
            const forwarded = await this._tryForwardOriginalMessage(msg, dmChannel);

            // Fallback if forwarding failed
            if (!forwarded) {
                await this._sendFallbackCaptchaMessage(userId, dmChannel);
            }
        } catch (error) {
            console.error('❌ Captcha Notification Error:', error);
        }
    }

    /**
     * Check if Telegram is configured for notifications
     * @returns {boolean}
     * @private
     */
    _isTelegramConfigured() {
        return telegramConfig && telegramConfig.botToken && telegramConfig.chatId;
    }

    /**
     * Build CAPTCHA notification message for Telegram
     * @param {Object} msg - IPC message containing CAPTCHA info
     * @returns {string} Formatted Telegram message
     * @private
     */
    _buildCaptchaTelegramMessage(msg) {
        const { userId, username, guildName, channelName } = msg;

        let locationInfo = '';
        if (guildName && channelName) {
            locationInfo = `
🏠 <b>Sunucu:</b> ${guildName}
📢 <b>Kanal:</b> ${channelName}`;
        }

        return `
🚨 <b>CAPTCHA Algılandı!</b>

👤 <b>Kullanıcı:</b> ${username || 'Unknown'}
🆔 <b>User ID:</b> <code>${userId}</code>${locationInfo}

⚠️ Bot durduruldu. Lütfen manuel kontrol ediniz.
`.trim();
    }

    /**
     * Send a message via Telegram API
     * @param {string} text - Message text to send
     * @returns {Promise<boolean>} Whether message was sent successfully
     * @private
     */
    async _sendTelegramApiRequest(text) {
        const { botToken, chatId } = telegramConfig;

        try {
            const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: text,
                    parse_mode: 'HTML',
                    disable_web_page_preview: true
                })
            });

            const data = await response.json();
            if (data.ok) {
                console.log('✅ Telegram CAPTCHA notification sent successfully');
                return true;
            } else {
                console.error('❌ Telegram API error:', data.description);
                return false;
            }
        } catch (error) {
            console.error('❌ Failed to send Telegram notification:', error.message);
            return false;
        }
    }

    async _sendTelegramNotification(msg) {
        if (!this._isTelegramConfigured()) {
            console.warn('⚠️ Telegram not configured for Notifier');
            return false;
        }

        const message = this._buildCaptchaTelegramMessage(msg);
        return await this._sendTelegramApiRequest(message);
    }

    _trackCaptchaMessage(userId, messageId, dmChannel) {
        // Auto-delete after 10 mins
        const timeoutId = setTimeout(async () => {
            try {
                const stored = this.captchaDmMessages.get(userId);
                if (stored?.messageId === messageId) {
                    await dmChannel.messages.delete(messageId);
                    this.captchaDmMessages.delete(userId);
                }
            } catch (e) { /* Ignore */ }
        }, TIMEOUTS.CAPTCHA_NOTIFICATION_CLEANUP);

        this.captchaDmMessages.set(userId, { messageId, timeoutId });
    }

    async _handleCaptchaSolved(userId) {
        const stored = this.captchaDmMessages.get(userId);
        if (!stored) return;

        try {
            if (stored.timeoutId) clearTimeout(stored.timeoutId);
            
            const user = await this.client.users.fetch(userId);
            const dm = await user.createDM();
            await dm.messages.delete(stored.messageId);
            console.log('✅ CAPTCHA DM deleted');
        } catch (error) {
            console.error('❌ Captcha Solved Error:', error.message);
        } finally {
            this.captchaDmMessages.delete(userId);
        }
    }

    // --- Interaction Handling ---

    async _onInteraction(interaction) {
        if (!this.authorizedUserIds.has(interaction.user.id)) {
            return await interaction.reply({ content: 'Unauthorized.', ephemeral: true });
        }

        try {
            if (interaction.isChatInputCommand()) {
                await this._handleCommand(interaction);
            } else if (interaction.isButton()) {
                await this._handleButton(interaction);
            }
        } catch (error) {
            console.error('Interaction Error:', error);
            if (!interaction.replied) {
                await interaction.reply({ content: 'Error processing command.', ephemeral: true }).catch(() => {});
            }
        }
    }

    async _handleCommand(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        if (interaction.commandName === 'selfbot') {
            await this._handleSelfbotCommand(interaction);
        } else if (interaction.commandName === 'channels') {
            await this._handleChannelsCommand(interaction);
        }
    }

    async _handleSelfbotCommand(interaction) {
        const command = interaction.options.getString('komut');
        
        if (command === 'farm') {
            // Initial UI
            const components = UIBuilder.generateFarmControlComponents(false, false, true);
            await interaction.editReply({ components, flags: MessageFlags.IsComponentsV2 });
        } else {
            // Send to worker
            const result = await this._sendIPCRequest(IPCMessageBuilder.buildCommandUsage({
                command,
                channelId: interaction.channelId,
                targetUserId: interaction.user.id,
                interactionId: interaction.id
            }), interaction.id);

            await interaction.editReply({ content: result.resultMessage });
        }
    }

    async _handleChannelsCommand(interaction) {
        const action = interaction.options.getString('action');
        const channelIds = interaction.options.getString('channel_ids');

        const result = await this._sendIPCRequest(IPCMessageBuilder.buildChannelsCommand({
            action,
            channelIds,
            targetUserId: interaction.user.id,
            interactionId: interaction.id
        }), interaction.id);

        await interaction.editReply({ content: `### CHANNELS\n${result.resultMessage}` });
    }

    async _handleButton(interaction) {
        if (interaction.customId === 'dismiss_alert') {
            await interaction.deferUpdate();
            await interaction.message.delete().catch(() => {});
            return;
        }

        if (interaction.customId.startsWith('farm_')) {
            await interaction.deferUpdate();
            const farmType = interaction.customId === 'farm_this_channel' ? 'this_channel' : 'permanent_channels';

            const result = await this._sendIPCRequest(IPCMessageBuilder.buildCommandUsage({
                command: 'farm',
                channelId: interaction.channelId,
                targetUserId: interaction.user.id,
                interactionId: interaction.id,
                farmType
            }), interaction.id);

            const isChannel = result.resultMessage.includes('bu kanalda');
            const isPerm = result.resultMessage.includes('Kalıcı');
            
            const components = UIBuilder.generateFarmControlComponents(isChannel, isPerm, false);
            await interaction.editReply({ components, flags: MessageFlags.IsComponentsV2 });
        }
    }

    _sendIPCRequest(payload, interactionId) {
        if (!process.send) return Promise.reject(new Error('No IPC channel'));
        
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.interactionHandlers.delete(interactionId);
                reject(new Error('Timeout'));
            }, TIMEOUTS.IPC_REQUEST_TIMEOUT);

            this.interactionHandlers.set(interactionId, (response) => {
                clearTimeout(timeout);
                resolve(response);
            });

            process.send(payload);
        });
    }
}

// Start Bot
const bot = new NotifierBot();
bot.start(process.env.BOT_TOKEN);
