const {
    ApplicationCommandOptionType,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    MessageFlags,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    ContainerBuilder
} = require('discord.js');

const RESPONSE_TIMEOUT = 15000;

/**
 * Slash commands definitions
 */
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

/**
 * Send V2 reply format
 * @param {Interaction} interaction - Discord interaction
 * @param {string} message - Message to send
 * @param {Array} components - Additional components
 * @returns {Promise<void>}
 */
async function sendV2Reply(interaction, message, components = []) {
    const textDisplay = new TextDisplayBuilder().setContent(message);
    const separator = new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small);
    const allComponents = [textDisplay, ...components, separator];

    await interaction.editReply({
        components: allComponents,
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    });
}

/**
 * Build farm embed content
 * @param {boolean} isChannelFarming - Whether channel farming is active
 * @param {boolean} isPermanentFarming - Whether permanent farming is active
 * @param {boolean} initialCall - Whether this is initial call
 * @returns {string} Formatted content
 */
function buildFarmEmbedContent(isChannelFarming, isPermanentFarming, initialCall = true) {
    let descriptionContent = '### Farm Sistemi Kontrol Paneli\n';

    if (!initialCall) {
        descriptionContent += '**Farm işleminiz başarıyla güncellendi!**\n\n' +
                            '• **Geçici Farm**: ' + (isChannelFarming ? 'Aktif' : 'Kapalı') + '\n' +
                            '• **Kalıcı Farm**: ' + (isPermanentFarming ? 'Aktif' : 'Kapalı') + '\n\n';
    }

    descriptionContent += '**Bu kanalda farm işlemini yönetmek için aşağıdaki butonları kullanabilirsiniz:**\n\n' +
                        '• **Geçici Farm**: Sadece bu kanalda geçici olarak farm yapar\n' +
                        '• **Kalıcı Farm**: Kayıtlı tüm kanallarda sürekli farm yapar\n\n' +
                        '*Farm durumunuzu aşağıdaki butonlarla kontrol edebilirsiniz.*';
    return descriptionContent;
}

/**
 * Generate farm control components
 * @param {boolean} isChannelFarming - Whether channel farming is active
 * @param {boolean} isPermanentFarming - Whether permanent farming is active
 * @param {boolean} initialCall - Whether this is initial call
 * @returns {Array} Formatted components
 */
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

/**
 * Wait for response from selfbot
 * @param {string} interactionId - Interaction ID
 * @param {Map} interactionHandlers - Interaction handlers map
 * @returns {Promise<Object>} Response object
 */
function waitForSelfbotResponse(interactionId, interactionHandlers) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            interactionHandlers.delete(interactionId);
            reject(new Error('Selfbot yanıt vermedi.'));
        }, RESPONSE_TIMEOUT);
        interactionHandlers.set(interactionId, (data) => {
            clearTimeout(timeout);
            resolve(data);
        });
    });
}

/**
 * Handle selfbot command
 * @param {Interaction} interaction - Discord interaction
 * @param {string} commandType - Command type
 * @param {Map} interactionHandlers - Interaction handlers map
 * @returns {Promise<void>}
 */
async function handleSelfbotCommand(interaction, commandType, interactionHandlers) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!process.send) {
        return await sendV2Reply(interaction, '### İşlem yapılamıyor.');
    }

    process.send({
        type: 'komut_kullanildi',
        command: commandType,
        channelId: interaction.channelId,
        interactionId: interaction.id,
        targetUserId: interaction.user.id
    });

    const { resultMessage, isOwoEnabled: currentOwoEnabledState } = await waitForSelfbotResponse(interaction.id, interactionHandlers);

    if (commandType === 'farm') {
        const farmComponents = generateFarmControlComponents(false, false, true);
        await interaction.editReply({
            components: farmComponents,
            flags: MessageFlags.IsComponentsV2
        });
        return;
    }

    await sendV2Reply(interaction, resultMessage);
}

/**
 * Handle channels command
 * @param {Interaction} interaction - Discord interaction
 * @param {string} action - Action to perform
 * @param {string} channelIdsString - Channel IDs string
 * @param {Map} interactionHandlers - Interaction handlers map
 * @returns {Promise<void>}
 */
async function handleChannelsCommand(interaction, action, channelIdsString, interactionHandlers) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!process.send) {
        return await sendV2Reply(interaction, '### İşlem yapılamıyor.');
    }

    process.send({
        type: 'channels_command',
        action: action,
        channelIds: channelIdsString,
        interactionId: interaction.id,
        targetUserId: interaction.user.id
    });

    const { resultMessage } = await waitForSelfbotResponse(interaction.id, interactionHandlers);
    await sendV2Reply(interaction, `### CHANNELS\n${resultMessage}`);
}

/**
 * Handle farm button click
 * @param {Interaction} interaction - Discord interaction
 * @param {string} farmType - Farm type ('this_channel' or 'permanent_channels')
 * @param {Map} interactionHandlers - Interaction handlers map
 * @returns {Promise<void>}
 */
async function handleFarmButtonClick(interaction, farmType, interactionHandlers) {
    await interaction.deferUpdate();

    if (!process.send) {
        return await interaction.editReply({ content: '### İşlem yapılamıyor.', components: [] });
    }

    process.send({
        type: 'komut_kullanildi',
        command: 'farm',
        farmType: farmType,
        channelId: interaction.channelId,
        interactionId: interaction.id,
        targetUserId: interaction.user.id
    });

    const { resultMessage } = await waitForSelfbotResponse(interaction.id, interactionHandlers);

    const isChannelFarming = resultMessage.includes('Farm bu kanalda başlatıldı') ||
                           resultMessage.includes('Farm duraklatıldı');

    const isPermanentFarming = resultMessage.includes('Kalıcı listedeki kanallar için farm etkinleştirildi') ||
                               resultMessage.includes('Farm devre dışı bırakıldı');

    const updatedComponents = generateFarmControlComponents(isChannelFarming, isPermanentFarming, false);

    await interaction.editReply({
        components: updatedComponents,
        flags: MessageFlags.IsComponentsV2
    });
}

module.exports = {
    commands,
    sendV2Reply,
    handleSelfbotCommand,
    handleChannelsCommand,
    handleFarmButtonClick
};