const {
  Client,
  GatewayIntentBits,
  REST,
  Partials,
  Routes,
  ApplicationCommandOptionType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ContainerBuilder,
  DefaultWebSocketManagerOptions
} = require('discord.js');
const { handleUncaughtException, handleUnhandledRejection } = require('../utils/errorHandler');
const { clearAllTrackedTimeouts } = require('../services/discordService');
const configManager = require('../config/manager');

// Get console log setting from config
let enableConsoleLog = false;
const loadConfig = async () => {
  try {
    const config = await configManager.loadConfig();
    if (config) {
      enableConsoleLog = config.enableConsoleLog || false;
    }
  } catch (error) {
    // Config might not be loaded yet, will retry later
  }
};

// Try to load config initially
loadConfig();

// Helper function for conditional logging
const conditionalLog = (...args) => {
  if (enableConsoleLog) {
    console.log(...args);
  }
};

const conditionalError = (...args) => {
  if (enableConsoleLog) {
    console.error(...args);
  }
};

// Fix for self-signed certificate error
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

DefaultWebSocketManagerOptions.identifyProperties.browser = 'Discord iOS';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// Set up global error handlers
process.on('uncaughtException', handleUncaughtException);
process.on('unhandledRejection', handleUnhandledRejection);



const interactionHandlers = new Map();
const authorizedUserIds = new Set();
const captchaDmMessages = new Map();
const userFarmStates = new Map(); // Kullanıcı başına farm durumunu takip et

process.on('message', (message) => {
  conditionalLog('📨 Bot.js: Process mesajı alındı:', message.type);
  if (message.type === 'komut_sonucu' && message.interactionId) {
    const handler = interactionHandlers.get(message.interactionId);
    if (handler) {
      handler({ resultMessage: message.resultMessage, isOwoEnabled: message.isOwoEnabled });
      interactionHandlers.delete(message.interactionId);
    }
  }
  else if (message.type === 'selfbot_ready') {
    authorizedUserIds.add(message.userId);
    cleanupOldAlertMessagesForUser(message.userId);
  }
  else if (message.type === 'captcha') {
    conditionalLog('📨 Bot.js: CAPTCHA mesajı alındı, DM gönderiliyor...');
    handleCaptchaNotification(message);
  }
  else if (message.type === 'captcha_solved') {
    handleCaptchaSolved(message.userId);
  }
  else if (message.type === 'owo_status_update') {
    // Update OWO status for all users
    authorizedUserIds.forEach(userId => {
      const currentState = userFarmStates.get(userId) || { isChannelFarming: false, isPermanentFarming: false };
      userFarmStates.set(userId, {
        ...currentState,
        isOwoEnabled: message.isOwoEnabled
      });
    });
    conditionalLog('📨 Bot.js: OWO status update received:', message.isOwoEnabled);
  }
  else if (message.type === 'farm_status_update' && message.userId) {
    // Update farm status based on command result
    const currentState = userFarmStates.get(message.userId) || { isChannelFarming: false, isPermanentFarming: false, activeChannelId: null };

    let newIsChannelFarming = currentState.isChannelFarming;
    let newIsPermanentFarming = currentState.isPermanentFarming;

    if (message.isChannelFarming !== undefined) {
      newIsChannelFarming = message.isChannelFarming;
      // When temporary farming is started, stop permanent farming
      if (newIsChannelFarming) {
        newIsPermanentFarming = false;
      }
    }

    if (message.isPermanentFarming !== undefined) {
      newIsPermanentFarming = message.isPermanentFarming;
      // When permanent farming is started, stop temporary farming
      if (newIsPermanentFarming) {
        newIsChannelFarming = false;
      }
    }

    userFarmStates.set(message.userId, {
      isChannelFarming: newIsChannelFarming,
      isPermanentFarming: newIsPermanentFarming,
      activeChannelId: message.channelId || null
    });
    conditionalLog('📨 Bot.js: Farm status update received for user:', message.userId);
  }
  else if (message.type === 'channel_monitor_alert') {
    client.users.fetch(message.userId).then(user => {
      user.createDM().then(dmChannel => {
        const alertText = new TextDisplayBuilder().setContent(
          `⚠️ **Farm Kanalı Uyarısı**\n\n` +
          `**Kullanıcı:** ${message.author || '-'}\n` +
          `**Kanal ID:** ${message.channelId || '-'}\n` +
          `**Mesaj:** ${message.content || '-'}\n\n` +
          `Lütfen uyarıyı gözden geçirin.`
        );
        const separator = new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small);
        const buttons = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('dismiss_alert')
            .setLabel('Tamam')
            .setStyle(ButtonStyle.Primary)
        );

        dmChannel.send({
          components: [alertText, buttons, separator],
          flags: MessageFlags.IsComponentsV2
        }).catch(err => {
          conditionalError('❌ Bot.js: Forward error:', err);
        });
      }).catch(err => {
        conditionalError('❌ Bot.js: DM channel creation error:', err);
      });
    }).catch(err => {
      conditionalError('❌ Bot.js: User fetch error:', err);
    });
  }
});

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
        choices: [
          { name: 'Farm', value: 'farm' },
        ],
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
        description: 'Eklenecek kanal ID\'leri (sadece Add için, virgülle ayırarak)',
        type: ApplicationCommandOptionType.String,
        required: false
      }
    ]
  },
  {
    name: 'setch',
    description: 'Kalıcı farm için geçici kanal listesi ayarla.',
    options: [
      {
        name: 'action',
        description: 'Yapılacak işlem',
        type: ApplicationCommandOptionType.String,
        required: true,
        choices: [
          { name: 'Set', value: 'set' },
          { name: 'Default', value: 'default' }
        ]
      },
      {
        name: 'channel_ids',
        description: 'Kanal ID\'leri (sadece Set için, virgülle ayırarak)',
        type: ApplicationCommandOptionType.String,
        required: false
      }
    ]
  },
  {
    name: 'click',
    description: 'Bir kanaldaki son bot mesajındaki butona tıkla.',
    options: [
      {
        name: 'channel_id',
        description: 'Tıklanacak mesajın bulunduğu kanal ID',
        type: ApplicationCommandOptionType.String,
        required: true
      }
    ]
  }
];

client.once('clientReady', async () => {
  conditionalLog('🤖 Bot.js: Discord bot başlatıldı:', client.user.tag);
  const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    conditionalLog('✅ Bot.js: Slash komutları kaydedildi');
  } catch (error) {
    conditionalError('❌ Bot.js: Slash komut kayıt hatası:', error);
  }
});

async function sendV2Reply(interaction, message, components = []) {
  const textDisplay = new TextDisplayBuilder().setContent(message);
  const separator = new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small);
  const allComponents = [textDisplay, ...components, separator];

  await interaction.editReply({
    components: allComponents,
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
  });
}

function buildFarmEmbedContent(isChannelFarming, isPermanentFarming) {
  return '### Farm Sistemi Kontrol Paneli\n'
    + '**Bu kanalda farm işlemini yönetmek için aşağıdaki butonları kullanabilirsiniz:**\n\n'
    + '• **Geçici Farm**: Sadece bu kanalda geçici olarak farm yapar\n'
    + '• **Kalıcı Farm**: Kayıtlı tüm kanallarda sürekli farm yapar\n\n'
    + '*Farm durumunuzu aşağıdaki butonlarla kontrol edebilirsiniz.*';
}

function generateFarmControlComponents(isChannelFarming, isPermanentFarming) {
  const temporaryButtonLabel = isChannelFarming ? 'Geçici Farmı Durdur' : 'Geçici Farm Başlat';
  const temporaryButtonStyle = isChannelFarming ? ButtonStyle.Danger : ButtonStyle.Success;

  const permanentButtonLabel = isPermanentFarming ? 'Kalıcı Farmı Durdur' : 'Kalıcı Farm Başlat';
  const permanentButtonStyle = isPermanentFarming ? ButtonStyle.Danger : ButtonStyle.Success;

  const farmButtonsRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('farm_this_channel')
      .setLabel(temporaryButtonLabel)
      .setStyle(temporaryButtonStyle),
    new ButtonBuilder()
      .setCustomId('farm_permanent_channels')
      .setLabel(permanentButtonLabel)
      .setStyle(permanentButtonStyle)
  );

  const embedContent = buildFarmEmbedContent();
  const textDisplay = new TextDisplayBuilder().setContent(embedContent);

  return [
    new ContainerBuilder()
      .addTextDisplayComponents(textDisplay)
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
      .addActionRowComponents(farmButtonsRow)
  ];
}

client.on('messageCreate', async message => {
  // Only handle DMs from authorized users
  if (!message.channel.isDMBased()) return;
  if (!authorizedUserIds.has(message.author.id)) return;
  if (message.author.bot) return;

  if (message.content.trim().toLowerCase() === '!sil') {
    try {
      const dmChannel = message.channel;
      const messages = await dmChannel.messages.fetch({ limit: 100 });
      const botMessages = messages.filter(msg => msg.author.id === client.user.id);

      if (botMessages.size === 0) {
        const textDisplay = new TextDisplayBuilder().setContent('ℹ️ Silinecek mesaj bulunamadı.');
        const separator = new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small);
        await dmChannel.send({
          components: [textDisplay, separator],
          flags: MessageFlags.IsComponentsV2
        });
        return;
      }

      let deletedCount = 0;
      for (const [id, msg] of botMessages) {
        try {
          await msg.delete();
          deletedCount++;
        } catch (err) {
          conditionalError('❌ Bot.js: Mesaj silme hatası:', err);
        }
      }

      // Clear all tracked CAPTCHA DM messages for this user
      const stored = captchaDmMessages.get(message.author.id);
      if (stored && stored.timeoutId) {
        clearTimeout(stored.timeoutId);
      }
      captchaDmMessages.delete(message.author.id);

      const textDisplay = new TextDisplayBuilder().setContent(`✅ **${deletedCount}** mesaj başarıyla silindi.`);
      const separator = new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small);

      const sentMsg = await dmChannel.send({
        components: [textDisplay, separator],
        flags: MessageFlags.IsComponentsV2
      });

      // 3 saniye sonra silinsin
      setTimeout(() => {
        sentMsg.delete().catch(() => { });
      }, 3000);
      conditionalLog(`🗑️ Bot.js: ${deletedCount} mesaj silindi (kullanıcı: ${message.author.id})`);
    } catch (error) {
      conditionalError('❌ Bot.js: !sil komutu hatası:', error);
    }
  }
});

let isOwoEnabled = false;

client.on('interactionCreate', async interaction => {
  if (!authorizedUserIds.has(interaction.user.id)) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    return await sendV2Reply(interaction, '### Bu komutu kullanma yetkiniz yok.');
  }

  try {
    if (interaction.isChatInputCommand()) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      // Check if it's the selfbot command or channels command
      if (interaction.commandName === 'selfbot') {
        const commandType = interaction.options.getString('komut');

        if (process.send) {
          process.send({
            type: 'komut_kullanildi',
            command: commandType,
            channelId: interaction.channelId,
            interactionId: interaction.id,
            targetUserId: interaction.user.id
          });
        } else {
          return await sendV2Reply(interaction, '### İşlem yapılamıyor.');
        }

        const { resultMessage, isOwoEnabled: currentOwoEnabledState } = await new Promise((resolve, reject) => {
          setTimeout(() => {
            interactionHandlers.delete(interaction.id);
            reject(new Error('Selfbot yanıt vermedi.'));
          }, 15000);
          interactionHandlers.set(interaction.id, resolve);
        });

        let components = [];

        if (commandType === 'farm') {
          // Get current farm state for this user
          const userState = userFarmStates.get(interaction.user.id) || { isChannelFarming: false, isPermanentFarming: false, activeChannelId: null };

          // Check if farming is active in THIS specific channel
          const isFarmingInThisChannel = userState.activeChannelId === interaction.channelId && userState.isChannelFarming;

          const farmComponents = generateFarmControlComponents(isFarmingInThisChannel, userState.isPermanentFarming);

          await interaction.editReply({
            components: farmComponents,
            flags: MessageFlags.IsComponentsV2
          });
          return;
        } else if (commandType === 'alert') {
          const confirmText = new TextDisplayBuilder().setContent('Alert komutu başarıyla kullanıldı.');
          const smallSep = new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small);
          const alertComponents = [confirmText, ...components, smallSep];
          components = alertComponents;
        }

        const buttonComponents = components.length > 0 ? components : [];
        await sendV2Reply(interaction, resultMessage, buttonComponents);
      } else if (interaction.commandName === 'channels') {
        const action = interaction.options.getString('action');
        const channelIdsString = interaction.options.getString('channel_ids');

        if (process.send) {
          process.send({
            type: 'channels_command',
            action: action,
            channelIds: channelIdsString,
            interactionId: interaction.id,
            targetUserId: interaction.user.id
          });
        } else {
          return await sendV2Reply(interaction, '### İşlem yapılamıyor.');
        }

        // Wait for response from selfbot
        const { resultMessage } = await new Promise((resolve, reject) => {
          setTimeout(() => {
            interactionHandlers.delete(interaction.id);
            reject(new Error('Selfbot yanıt vermedi.'));
          }, 15000);
          interactionHandlers.set(interaction.id, resolve);
        });

        await sendV2Reply(interaction, `### CHANNELS\n${resultMessage}`);
      } else if (interaction.commandName === 'setch') {
        const action = interaction.options.getString('action');
        const channelIdsString = interaction.options.getString('channel_ids');

        if (process.send) {
          process.send({
            type: 'setch_command',
            action: action,
            channelIds: channelIdsString,
            interactionId: interaction.id,
            targetUserId: interaction.user.id
          });
        } else {
          return await sendV2Reply(interaction, '### İşlem yapılamıyor.');
        }

        // Wait for response from selfbot
        const { resultMessage } = await new Promise((resolve, reject) => {
          setTimeout(() => {
            interactionHandlers.delete(interaction.id);
            reject(new Error('Selfbot yanıt vermedi.'));
          }, 15000);
          interactionHandlers.set(interaction.id, resolve);
        });

        await sendV2Reply(interaction, `### SETCH\n${resultMessage}`);
      } else if (interaction.commandName === 'click') {
        const channelId = interaction.options.getString('channel_id');

        await sendV2Reply(interaction, '### CLICK\nTıklanıyor...');

        try {
          const channel = await client.channels.fetch(channelId);
          if (!channel || !channel.isTextBased()) {
            return await sendV2Reply(interaction, '### CLICK\n❌ Geçerli bir metin kanalı bulunamadı.');
          }

          const messages = await channel.messages.fetch({ limit: 10 });
          const botMessage = messages.find(m => m.author.bot && m.components.length > 0);

          if (!botMessage) {
            return await sendV2Reply(interaction, '### CLICK\n❌ Kanaldas bot mesajı veya buton bulunamadı.');
          }

          const button = botMessage.components.first()?.component;
          if (!button) {
            return await sendV2Reply(interaction, '### CLICK\n❌ Buton bulunamadı.');
          }

          await botMessage.clickButton(button.customId);
          await sendV2Reply(interaction, `### CLICK\n✅ Butona tıklandı! (${button.label || button.customId})`);
        } catch (error) {
          conditionalError('❌ Bot.js: Click komut hatası:', error);
          await sendV2Reply(interaction, `### CLICK\n❌ Hata: ${error.message}`);
        }
        return;
      }

    } else if (interaction.isButton()) {
      if (interaction.customId === 'dismiss_alert') {
        await interaction.deferUpdate();
        await interaction.message.delete().catch(err => {
          conditionalError('❌ Bot.js: Dismiss alert error:', err);
        });
      } else if (interaction.customId === 'farm_this_channel' || interaction.customId === 'farm_permanent_channels') {
        await interaction.deferUpdate();

        const commandType = 'farm';
        const farmType = interaction.customId === 'farm_this_channel' ? 'this_channel' : 'permanent_channels';

        if (process.send) {
          process.send({
            type: 'komut_kullanildi',
            command: commandType,
            farmType: farmType,
            channelId: interaction.channelId,
            interactionId: interaction.id,
            targetUserId: interaction.user.id
          });
        } else {
          return await interaction.editReply({ content: '### İşlem yapılamıyor.', components: [] });
        }

        const { resultMessage, isOwoEnabled: currentOwoEnabledState } = await new Promise((resolve, reject) => {
          setTimeout(() => {
            interactionHandlers.delete(interaction.id);
            reject(new Error('Selfbot yanıt vermedi.'));
          }, 15000);
          interactionHandlers.set(interaction.id, resolve);
        });

        // Farm durumunu belirle ve state'i güncelle - resultMessage içindeki anahtar kelimeleri kontrol et
        let isChannelFarming = false;
        let isPermanentFarming = false;

        if (farmType === 'this_channel') {
          isChannelFarming = resultMessage.includes('Farm started in this channel');
          // Temporary farming başladığında permanent farming durdurulur
          if (isChannelFarming) {
            isPermanentFarming = false;
          }
        } else if (farmType === 'permanent_channels') {
          isPermanentFarming = resultMessage.includes('Farming enabled for permanent channels');
          // Permanent farming başladığında temporary farming durdurulur
          if (isPermanentFarming) {
            isChannelFarming = false;
          }
        } else if (farmType === 'permanent_channels' && resultMessage.includes('Farming disabled')) {
          isPermanentFarming = false;
        }

        // Kullanıcının farm durumunu güncelle - temporary farming sadece bu kanala özel
        const currentUserState = userFarmStates.get(interaction.user.id) || { isChannelFarming: false, isPermanentFarming: false };

        let newIsChannelFarming = currentUserState.isChannelFarming;
        let newIsPermanentFarming = currentUserState.isPermanentFarming;

        if (farmType === 'this_channel') {
          newIsChannelFarming = isChannelFarming;
          if (isChannelFarming) {
            newIsPermanentFarming = false;
          }
        } else if (farmType === 'permanent_channels' && isPermanentFarming) {
          // Permanent farming başladığında temporary farming durdurulur
          newIsChannelFarming = false;
          newIsPermanentFarming = true;
        } else if (farmType === 'permanent_channels' && !isPermanentFarming) {
          newIsPermanentFarming = false;
        }

        userFarmStates.set(interaction.user.id, {
          isChannelFarming: newIsChannelFarming,
          isPermanentFarming: newIsPermanentFarming,
          activeChannelId: farmType === 'this_channel' && newIsChannelFarming ? interaction.channelId : null
        });

        const updatedComponents = generateFarmControlComponents(newIsChannelFarming, isPermanentFarming);

        await interaction.editReply({
          components: updatedComponents,
          flags: MessageFlags.IsComponentsV2
        });
      }
    }
  } catch (error) {
    conditionalError('❌ Bot.js: Komut işlenirken hata oluştu:', error);
    try {
      await sendV2Reply(interaction, '### Komut işlenirken bir hata oluştu.');
    } catch (e) {
      conditionalError('❌ Bot.js: Hata mesajı gönderilirken hata oluştu:', e);
    }
  }
});


process.on('exit', (code) => {
  conditionalLog(`Process kapanıyor. Çıkış kodu: ${code}`);
  // client.user.setActivity('kapanıyor', { type: ActivityType.Playing }); // ActivityType is not defined here
  clearAllTrackedTimeouts();
  client.destroy();
});

async function handleCaptchaNotification(msgData) {
  const { userId, messageId, channelId, channelName, guildId, guildName } = msgData;
  conditionalLog('🔍 Bot.js: handleCaptchaNotification başlıyor...', { userId, messageId, channelId, guildId });
  try {
    conditionalLog('👤 Bot.js: Kullanıcı fetch ediliyor...', userId);
    const user = await client.users.fetch(userId);
    conditionalLog('✅ Bot.js: Kullanıcı fetch edildi:', user.username);
    conditionalLog('💬 Bot.js: DM kanalı oluşturuluyor...');
    const dmChannel = await user.createDM();
    conditionalLog('✅ Bot.js: DM kanalı oluşturuldu:', dmChannel.id);

    let sentMessage = null;
    const captchaContent = `⚠️ **CAPTCHA Tespit Edildi**\n\nCAPTCHA tespit edildi! Lütfen CAPTCHA'yı manuel olarak çözün.\n\n**Sunucu:** ${guildName || 'Bilinmiyor'}\n**Kanal:** ${channelName || 'Bilinmiyor'}`;

    const textDisplay = new TextDisplayBuilder().setContent(captchaContent);
    const separator = new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small);

    sentMessage = await dmChannel.send({
      components: [textDisplay, separator],
      flags: MessageFlags.IsComponentsV2
    });
    conditionalLog('✅ Bot.js: CAPTCHA bildirimi gönderildi');

    if (sentMessage) {
      conditionalLog('✅ Bot.js: DM mesajı başarıyla gönderildi! Message ID:', sentMessage.id);
      const messageId = sentMessage.id;

      // Set timeout for automatic deletion after 10 minutes
      const timeoutId = setTimeout(async () => {
        conditionalLog('⏰ Bot.js: 10 dakika timeout doldu, DM mesajı siliniyor...');
        try {
          const stored = captchaDmMessages.get(userId);
          if (stored && stored.messageId === messageId) {
            conditionalLog('🗑️ Bot.js: Timeout ile DM mesajı siliniyor...');
            await dmChannel.messages.delete(messageId);
            captchaDmMessages.delete(userId);
            conditionalLog('✅ Bot.js: DM mesajı timeout ile silindi');
          } else {
            conditionalLog('ℹ️ Bot.js: DM mesajı zaten silinmiş veya bulunamadı');
          }
        } catch (error) {
          conditionalError('❌ Bot.js: DM silme hatası (timeout):', error);
        }
      }, 10 * 60 * 1000); // 10 dakika

      // Store the message info for later deletion
      captchaDmMessages.set(userId, { messageId, timeoutId });
      conditionalLog('📋 Bot.js: CAPTCHA DM mesajı track ediliyor:', { userId, messageId, timeoutId: !!timeoutId });
      conditionalLog('⏰ Bot.js: 10 dakika timeout ayarlandı');
    } else {
      conditionalError('❌ Bot.js: DM mesajı gönderilemedi!');
    }
  } catch (error) {
    conditionalError('❌ Bot.js: Captcha notification hatası:', error);
  }
}

async function handleCaptchaSolved(userId) {
  conditionalLog('🔍 Bot.js: handleCaptchaSolved çağrıldı, userId:', userId);
  const stored = captchaDmMessages.get(userId);

  if (!stored) {
    conditionalLog('⚠️ Bot.js: Silinecek CAPTCHA DM mesajı bulunamadı');
    return;
  }

  conditionalLog('📋 Bot.js: Stored DM data:', { messageId: stored.messageId, hasTimeout: !!stored.timeoutId });

  try {
    // Clear the timeout first
    if (stored.timeoutId) {
      clearTimeout(stored.timeoutId);
      conditionalLog('✅ Bot.js: Timeout temizlendi');
    }

    // Fetch user and DM channel
    conditionalLog('👤 Bot.js: Kullanıcı fetch ediliyor...');
    const user = await client.users.fetch(userId);
    conditionalLog('✅ Bot.js: Kullanıcı fetch edildi:', user.username);

    conditionalLog('💬 Bot.js: DM kanalı oluşturuluyor...');
    const dmChannel = await user.createDM();
    conditionalLog('✅ Bot.js: DM kanalı oluşturuldu:', dmChannel.id);

    // Delete the message
    conditionalLog('🗑️ Bot.js: DM mesajı siliniyor, messageId:', stored.messageId);
    await dmChannel.messages.delete(stored.messageId);
    conditionalLog('✅ Bot.js: CAPTCHA DM mesajı başarıyla silindi');
  } catch (error) {
    conditionalError('❌ Bot.js: CAPTCHA çözüldü DM silme hatası:', error);
    conditionalError('❌ Bot.js: Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      httpStatus: error.httpStatus
    });
  } finally {
    captchaDmMessages.delete(userId);
    conditionalLog('✅ Bot.js: CAPTCHA DM mesajı verisi temizlendi');
  }
}

async function cleanupOldAlertMessagesForUser(userId) {
  try {
    const user = await client.users.fetch(userId);
    const dmChannel = await user.createDM();
    const messages = await dmChannel.messages.fetch({ limit: 50 });
    for (const [id, msg] of messages) {
      if (msg.author.id === client.user.id && msg.content.includes('Farm kanalına birisi yazdı')) {
        await msg.delete().catch(err => {
          conditionalError('❌ Bot.js: Old alert message deletion error:', err);
        });
      }
    }
  } catch (error) {
    conditionalError('Eski mesajlar temizleme hatası:', error);
  }
}


client.login(process.env.BOT_TOKEN).catch(error => {
  conditionalError('❌ Bot.js: Discord bot giriş hatası:', error);
});
