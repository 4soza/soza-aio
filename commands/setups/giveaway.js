// /giveaway ala OwO: start, end, reroll, list, delete
const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const GiveawayController = require('../../models/giveaway/Controller');
const checkPermissions = require('../../utils/checkPermissions');

const idOption = (o) => o.setName('message_id').setDescription('ID pesan giveaway').setRequired(true);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Giveaway ala OwO')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand((s) => s.setName('start').setDescription('Mulai giveaway baru')
      .addStringOption((o) => o.setName('prize').setDescription('Hadiah').setRequired(true).setMaxLength(512))
      .addStringOption((o) => o.setName('duration').setDescription('Durasi, contoh: 30m, 2h, 1d').setRequired(true))
      .addIntegerOption((o) => o.setName('winners').setDescription('Jumlah pemenang (1-100)').setMinValue(1).setMaxValue(100))
      .addChannelOption((o) => o.setName('channel').setDescription('Channel giveaway').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)))
    .addSubcommand((s) => s.setName('end').setDescription('Akhiri giveaway sekarang').addStringOption(idOption))
    .addSubcommand((s) => s.setName('reroll').setDescription('Acak ulang pemenang')
      .addStringOption(idOption)
      .addIntegerOption((o) => o.setName('winners').setDescription('Jumlah pemenang baru').setMinValue(1).setMaxValue(100)))
    .addSubcommand((s) => s.setName('list').setDescription('Daftar giveaway aktif di server'))
    .addSubcommand((s) => s.setName('delete').setDescription('Hapus giveaway').addStringOption(idOption)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    if (!await checkPermissions(interaction)) return;
    const reply = (text) => interaction.editReply({ content: text });
    const sub = interaction.options.getSubcommand();

    try {
      if (sub === 'start') {
        const prize = interaction.options.getString('prize');
        const winners = interaction.options.getInteger('winners') || 1;
        const channel = interaction.options.getChannel('channel') || interaction.channel;
        const durationMs = GiveawayController.parseDuration(interaction.options.getString('duration'));
        if (!durationMs) return reply('🚫 **|** Durasi tidak valid. Contoh: `30m`, `2h`, `1d` (10 detik sampai 30 hari).');
        if (await GiveawayController.activeInChannel(channel.id)) return reply('🚫 **|** A giveaway already exists in this channel!');
        await GiveawayController.create({ channel, hostId: interaction.user.id, prize, durationMs, winners });
        return reply(`🎉 **|** Giveaway dibuat di ${channel}!`);
      }

      if (sub === 'list') {
        const items = await GiveawayController.list(interaction.guild.id);
        if (!items.length) return reply('🚫 **|** Tidak ada giveaway aktif.');
        const lines = items.map((g) => `• **${g.prize}** — <#${g.channelId}> • berakhir <t:${Math.floor(g.endTime.getTime() / 1000)}:R> • ${g.entries.length} Users\n  ID: \`${g.messageId}\``);
        return reply(`🎉 **|** Giveaway aktif:\n${lines.join('\n')}`.slice(0, 2000));
      }

      const messageId = interaction.options.getString('message_id').trim();
      const found = await GiveawayController.get(messageId);
      if (!found || found.guildId !== interaction.guild.id) return reply('🚫 **|** Giveaway tidak ditemukan.');

      if (sub === 'end') {
        if (found.status !== 'active') return reply('🚫 **|** Giveaway ini sudah berakhir.');
        await GiveawayController.end(interaction.client, messageId);
        return reply('🎉 **|** Giveaway diakhiri.');
      }
      if (sub === 'reroll') {
        if (found.status !== 'ended') return reply('🚫 **|** Giveaway ini belum berakhir.');
        await GiveawayController.reroll(interaction.client, messageId, interaction.options.getInteger('winners'));
        return reply('🎉 **|** Pemenang diacak ulang.');
      }
      if (sub === 'delete') {
        await GiveawayController.remove(interaction.client, messageId);
        return reply('🎉 **|** Giveaway dihapus.');
      }
    } catch (error) {
      console.error('Giveaway command error:', error);
      return reply('🚫 **|** Terjadi error, coba lagi.');
    }
  }
};
