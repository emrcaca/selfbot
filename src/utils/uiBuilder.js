const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    ContainerBuilder,
    MessageFlags
} = require('discord.js');

class UIBuilder {
    static buildFarmEmbedContent(isChannelFarming, isPermanentFarming, initialCall) {
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

    static generateFarmControlComponents(isChannelFarming, isPermanentFarming, initialCall = true) {
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

        const embedContent = this.buildFarmEmbedContent(isChannelFarming, isPermanentFarming, initialCall);
        const textDisplay = new TextDisplayBuilder().setContent(embedContent);

        return [
            new ContainerBuilder()
                .addTextDisplayComponents(textDisplay)
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addActionRowComponents(farmButtonsRow)
        ];
    }
    
    static createAlertMessage(channelId, author, content) {
        const alertText = new TextDisplayBuilder().setContent(
          `⚠️ **Farm Kanalı Uyarısı**\n\n` +
          `**Kullanıcı:** ${author || '-'}\n` +
          `**Kanal ID:** ${channelId || '-'}\n` +
          `**Mesaj:** ${content || '-'}\n\n` +
          `Lütfen uyarıyı gözden geçirin.`
        );
        const separator = new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small);
        const buttons = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('dismiss_alert')
            .setLabel('Tamam')
            .setStyle(ButtonStyle.Primary)
        );
        
        return {
            components: [alertText, buttons, separator],
            flags: MessageFlags.IsComponentsV2
        };
    }
}

module.exports = UIBuilder;
