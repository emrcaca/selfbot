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
  EmbedBuilder,
  MessageFlags,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ContainerBuilder,
  DefaultWebSocketManagerOptions,
  Message,
  DiscordjsError,
  ErrorCodes
} = require('discord.js');
const { handleUncaughtException, handleUnhandledRejection } = require('../utils/errorHandler');
const { clearAllTrackedTimeouts } = require('../services/discordService');

// Fix for self-signed certificate error
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

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

const interactionHandlers = new Map();
const authorizedUserIds = new Set();
const captchaDmMessages = new Map();

process.on('message', (message) => {
  console.log('📨 Bot.js: Process mesajı alındı:', message.type);
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
    console.log('📨 Bot.js: CAPTCHA mesajı alındı, DM gönderiliyor...');
    handleCaptchaNotification(message);
  }
  else if (message.type === 'captcha_solved') {
    handleCaptchaSolved(message.userId);
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
                console.error('❌ Bot.js: Forward error:', err);
              });
              }).catch(err => {
                console.error('❌ Bot.js: DM channel creation error:', err);
              });
            }).catch(err => {
                console.error('❌ Bot.js: User fetch error:', err);
              });
          }
  else if (message.type === 'owo_status_update') {
    isOwoEnabled = message.isOwoEnabled;
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
  }
];

client.once('clientReady', async () => {
  console.log('🤖 Bot.js: Discord bot başlatıldı:', client.user.tag);
  const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('✅ Bot.js: Slash komutları kaydedildi');
  } catch (error) {
    console.error('❌ Bot.js: Slash komut kayıt hatası:', error);
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

function buildFarmEmbedContent(isChannelFarming, isPermanentFarming, initialCall) {
    let descriptionContent = '### Farm Sistemi Kontrol Paneli\n'; // Removed 🌾
    if (!initialCall) {
        descriptionContent += '**Farm işleminiz başarıyla güncellendi!**\n\n' +
                              '• **Geçici Farm**: ' + (isChannelFarming ? 'Aktif' : 'Kapalı') + '\n' + // Removed 🌱, ✅, ❌
                              '• **Kalıcı Farm**: ' + (isPermanentFarming ? 'Aktif' : 'Kapalı') + '\n\n'; // Removed 🌳, ✅, ❌
    }

    descriptionContent += '**Bu kanalda farm işlemini yönetmek için aşağıdaki butonları kullanabilirsiniz:**\n\n' +
                          '• **Geçici Farm**: Sadece bu kanalda geçici olarak farm yapar\n' + // Removed 🌱
                          '• **Kalıcı Farm**: Kayıtlı tüm kanallarda sürekli farm yapar\n\n' + // Removed 🌳
                          '*Farm durumunuzu aşağıdaki butonlarla kontrol edebilirsiniz.*';
    return descriptionContent;
}

function generateFarmControlComponents(isChannelFarming, isPermanentFarming, initialCall = true) {
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

    const embedContent = buildFarmEmbedContent(isChannelFarming, isPermanentFarming, initialCall);
    const textDisplay = new TextDisplayBuilder().setContent(embedContent);

    return [
        new ContainerBuilder()
            .addTextDisplayComponents(textDisplay)
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addActionRowComponents(farmButtonsRow)
    ];
}

client.on('messageCreate', async message => {
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
                                    // For initial button states, we'll assume default values
                                    const isChannelFarming = false;
                                    const isPermanentFarming = false;
                                    
                                    const farmComponents = generateFarmControlComponents(isChannelFarming, isPermanentFarming, true);
                                    
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
            }

    } else if (interaction.isButton()) {
            if (interaction.customId === 'dismiss_alert') {
                await interaction.deferUpdate();
                                await interaction.message.delete().catch(err => {
                                  console.error('❌ Bot.js: Dismiss alert error:', err);
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

                // Farm durumunu belirle
                const isChannelFarming = resultMessage.includes('Farm bu kanalda başlatıldı') ||
                                       resultMessage.includes('Farm duraklatıldı') &&
                                       interaction.channelId === interaction.message.interaction?.channelId;
                                        
                const isPermanentFarming = resultMessage.includes('Kalıcı listedeki kanallar için farm etkinleştirildi') ||
                                          resultMessage.includes('Farm devre dışı bırakıldı');
                                        
                const updatedComponents = generateFarmControlComponents(isChannelFarming, isPermanentFarming, false);
                
                await interaction.editReply({
                    components: updatedComponents,
                    flags: MessageFlags.IsComponentsV2
                });
            }
        }
  } catch (error) {
      console.error('❌ Bot.js: Komut işlenirken hata oluştu:', error);
      try {
        await sendV2Reply(interaction, '### Komut işlenirken bir hata oluştu.');
      } catch (e) {
        console.error('❌ Bot.js: Hata mesajı gönderilirken hata oluştu:', e);
      }
  }
});


process.on('exit', (code) => {
  console.log(`Process kapanıyor. Çıkış kodu: ${code}`);
  // client.user.setActivity('kapanıyor', { type: ActivityType.Playing }); // ActivityType is not defined here
  clearAllTrackedTimeouts();
  client.destroy();
});

async function handleCaptchaNotification(msgData) {
  const { userId, messageId, channelId, guildId } = msgData;
  console.log('🔍 Bot.js: handleCaptchaNotification başlıyor...', { userId, messageId, channelId, guildId });
  try {
    console.log('👤 Bot.js: Kullanıcı fetch ediliyor...', userId);
    const user = await client.users.fetch(userId);
    console.log('✅ Bot.js: Kullanıcı fetch edildi:', user.username);
    console.log('💬 Bot.js: DM kanalı oluşturuluyor...');
    const dmChannel = await user.createDM();
    console.log('✅ Bot.js: DM kanalı oluşturuldu:', dmChannel.id);
    let originalMsg = null;
    if (messageId && channelId && guildId) {
      const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
      if (guild) {
        const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
        if (channel) {
          originalMsg = await channel.messages.fetch(messageId).catch(() => null);
        }
      }
    }

    let sentMessage = null;
    if (originalMsg) {
      try {
        console.log('📤 Bot.js: Orijinal mesaj forward ediliyor...');
        sentMessage = await originalMsg.forward(dmChannel);
        console.log('✅ Bot.js: Orijinal mesaj forward edildi');
      } catch (forwardError) {
        console.error('❌ Bot.js: Forward hatası:', forwardError);
        console.log('📤 Bot.js: Fallback mesajı gönderiliyor...');
        const textDisplay = new TextDisplayBuilder().setContent('⚠️ **CAPTCHA Tespit Edildi**\n\nCAPTCHA tespit edildi! Lütfen CAPTCHA\'yı manuel olarak çözün.\n\n*Orijinal mesaj forward edilemedi.*');
        const separator = new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small);
        
        sentMessage = await dmChannel.send({
          components: [textDisplay, separator],
          flags: MessageFlags.IsComponentsV2
        });
        console.log('✅ Bot.js: Fallback mesajı gönderildi');
      }
    } else {
      console.log('⚠️ Bot.js: Orijinal mesaj bulunamadı, fallback mesajı gönderiliyor...');
      const textDisplay = new TextDisplayBuilder().setContent('⚠️ **CAPTCHA Tespit Edildi**\n\nCAPTCHA tespit edildi! Orijinal mesaj alınamadı, lütfen manuel olarak kontrol edin.\n\n*Orijinal mesaj bilgileri eksik.*');
      const separator = new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small);
      
      sentMessage = await dmChannel.send({
        components: [textDisplay, separator],
        flags: MessageFlags.IsComponentsV2
      });
      console.log('✅ Bot.js: Fallback mesajı gönderildi');
    }

    if (sentMessage) {
      console.log('✅ Bot.js: DM mesajı başarıyla gönderildi! Message ID:', sentMessage.id);
      const messageId = sentMessage.id;
      
      // Set timeout for automatic deletion after 10 minutes
      const timeoutId = setTimeout(async () => {
        console.log('⏰ Bot.js: 10 dakika timeout doldu, DM mesajı siliniyor...');
        try {
          const stored = captchaDmMessages.get(userId);
          if (stored && stored.messageId === messageId) {
            console.log('🗑️ Bot.js: Timeout ile DM mesajı siliniyor...');
            await dmChannel.messages.delete(messageId);
            captchaDmMessages.delete(userId);
            console.log('✅ Bot.js: DM mesajı timeout ile silindi');
          } else {
            console.log('ℹ️ Bot.js: DM mesajı zaten silinmiş veya bulunamadı');
          }
        } catch (error) {
          console.error('❌ Bot.js: DM silme hatası (timeout):', error);
        }
      }, 10 * 60 * 1000); // 10 dakika

      // Store the message info for later deletion
      captchaDmMessages.set(userId, { messageId, timeoutId });
      console.log('📋 Bot.js: CAPTCHA DM mesajı track ediliyor:', { userId, messageId, timeoutId: !!timeoutId });
      console.log('⏰ Bot.js: 10 dakika timeout ayarlandı');
    } else {
      console.error('❌ Bot.js: DM mesajı gönderilemedi!');
    }
  } catch (error) {
    console.error('❌ Bot.js: Captcha notification hatası:', error);
  }
}

async function handleCaptchaSolved(userId) {
  console.log('🔍 Bot.js: handleCaptchaSolved çağrıldı, userId:', userId);
  const stored = captchaDmMessages.get(userId);
  
  if (!stored) {
    console.log('⚠️ Bot.js: Silinecek CAPTCHA DM mesajı bulunamadı');
    return;
  }

  console.log('📋 Bot.js: Stored DM data:', { messageId: stored.messageId, hasTimeout: !!stored.timeoutId });

  try {
    // Clear the timeout first
    if (stored.timeoutId) {
      clearTimeout(stored.timeoutId);
      console.log('✅ Bot.js: Timeout temizlendi');
    }

    // Fetch user and DM channel
    console.log('👤 Bot.js: Kullanıcı fetch ediliyor...');
    const user = await client.users.fetch(userId);
    console.log('✅ Bot.js: Kullanıcı fetch edildi:', user.username);
    
    console.log('💬 Bot.js: DM kanalı oluşturuluyor...');
    const dmChannel = await user.createDM();
    console.log('✅ Bot.js: DM kanalı oluşturuldu:', dmChannel.id);
    
    // Delete the message
    console.log('🗑️ Bot.js: DM mesajı siliniyor, messageId:', stored.messageId);
    await dmChannel.messages.delete(stored.messageId);
    console.log('✅ Bot.js: CAPTCHA DM mesajı başarıyla silindi');
  } catch (error) {
    console.error('❌ Bot.js: CAPTCHA çözüldü DM silme hatası:', error);
    console.error('❌ Bot.js: Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      httpStatus: error.httpStatus
    });
  } finally {
    captchaDmMessages.delete(userId);
    console.log('✅ Bot.js: CAPTCHA DM mesajı verisi temizlendi');
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
                console.error('❌ Bot.js: Old alert message deletion error:', err);
              });
      }
    }
  } catch (error) {
    console.error('Eski mesajlar temizleme hatası:', error);
  }
}

console.log('🚀 Bot.js: Discord bot giriş yapılıyor...');
process.on('uncaughtException', (err) => {
  console.error('❌ Bot.js: Yakalanmayan istisna:', err);
  process.exit(1); // Hata durumunda süreci sonlandır
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Bot.js: İşlenmeyen reddedilme:', reason, promise);
});

client.login(process.env.BOT_TOKEN).catch(error => {
  console.error('❌ Bot.js: Discord bot giriş hatası:', error);
});
