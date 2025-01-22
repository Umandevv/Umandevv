const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('./config.json');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [
  {
    name: 'setup',
    description: 'Destek talebi oluşturma mesajını ayarlar.',
  },
];

const rest = new REST({ version: '10' }).setToken(config.token);

// Slash komutlarını yükle
(async () => {
  try {
    console.log('Slash komutları yükleniyor...');
    await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: commands });
    console.log('Slash komutları başarıyla yüklendi.');
  } catch (error) {
    console.error('Komut yükleme sırasında hata oluştu:', error);
  }
})();

client.once('ready', () => {
  console.log(`${client.user.tag} aktif!`);
});

// "setup" komutunu dinleme
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === 'setup') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: 'Bu komutu kullanmak için yetkiniz yok.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('Emperor - Destek Talebi')
      .setDescription('Desteğe mi ihtiyacın var? Hemen destek talebi oluştur.\n\nDestek talebi oluşturmak için aşağıdaki butona basınız.')
      .setColor('#3498db');

    const button = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('create_ticket')
        .setLabel('Destek Talebi Oluştur')
        .setStyle(ButtonStyle.Primary)
    );

    const channel = interaction.guild.channels.cache.get(config.channelId);
    if (!channel) {
      return interaction.reply({ content: 'Belirtilen kanal bulunamadı.', ephemeral: true });
    }

    await channel.send({ embeds: [embed], components: [button] });
    await interaction.reply({ content: 'Destek mesajı başarıyla gönderildi.', ephemeral: true });
  }
});

// Buton etkileşimlerini dinleme
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'create_ticket') {
    const category = interaction.guild.channels.cache.get(config.categoryId);
    if (!category) {
      return interaction.reply({ content: 'Kategori bulunamadı.', ephemeral: true });
    }

    const existingChannel = interaction.guild.channels.cache.find(
      (c) => c.name === `ticket-${interaction.user.username.toLowerCase()}`
    );

    if (existingChannel) {
      return interaction.reply({ content: 'Zaten açık bir destek talebiniz var.', ephemeral: true });
    }

    const channel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: 0, // Text channel
      parent: category.id,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel],
        },
        {
          id: interaction.user.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
        },
        {
          id: config.supportRoleId,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
        },
      ],
    });

    const embed = new EmbedBuilder()
      .setTitle('Emperor - Destek Talebi')
      .setDescription(
        `Destek talebiniz oluşturuldu. Lütfen sabırla yetkililerin yardımcı olmasını bekleyiniz.\n\n<@&${config.supportRoleId}>`
      )
      .setColor('#90EE90');

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('claim_ticket').setLabel('Talebi Sahiplen').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('close_ticket').setLabel('Kapat').setStyle(ButtonStyle.Danger)
    );

    await channel.send({ embeds: [embed], components: [buttons] });
    await interaction.reply({ content: `Destek talebiniz oluşturuldu: <#${channel.id}>`, ephemeral: true });
  }

  if (interaction.customId === 'claim_ticket') {
    const channel = interaction.channel;

    if (channel.topic === `Claimed by ${interaction.user.id}`) {
      return interaction.reply({ content: 'Bu talebi zaten sahiplendiniz.', ephemeral: true });
    }

    if (channel.topic && channel.topic.startsWith('Claimed by')) {
      return interaction.reply({ content: 'Bu talep başka bir kişi tarafından sahiplenilmiş.', ephemeral: true });
    }

    channel.setTopic(`Claimed by ${interaction.user.id}`);
    await interaction.reply({ content: 'Bu talebi sahiplendiniz.', ephemeral: false });
  }

  if (interaction.customId === 'close_ticket') {
    const channel = interaction.channel;

    if (!channel.name.startsWith('ticket-')) {
      return interaction.reply({ content: 'Bu kanal bir destek talebi değil.', ephemeral: true });
    }

    await channel.edit({ name: `closed-${channel.name.split('-')[1]}` });
    await interaction.reply({ content: 'Talep kapatıldı. Kapatma işlemi tamamlandıktan sonra kanalı silebilirsiniz.' });

    const deleteButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('delete_ticket').setLabel('Sil').setStyle(ButtonStyle.Danger)
    );

    await channel.send({ content: 'Bu kanalı silmek için aşağıdaki butona tıklayın.', components: [deleteButton] });
  }

  if (interaction.customId === 'delete_ticket') {
    const channel = interaction.channel;

    await interaction.reply({ content: 'Kanal siliniyor...', ephemeral: true });
    await channel.delete();
  }
});

client.login(config.token);
