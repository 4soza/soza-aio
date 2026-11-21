// Handler giveaway ala OwO: tombol Join + pengecek giveaway yang sudah berakhir.
const GiveawayController = require('../models/giveaway/Controller');

module.exports = (client) => {
  client.once('ready', () => {
    setInterval(async () => {
      try {
        const expired = await GiveawayController.expired();
        for (const g of expired) {
          await GiveawayController.end(client, g.messageId).catch((e) => console.error('Giveaway end error:', e));
        }
      } catch (error) {
        console.error('Giveaway checker error:', error);
      }
    }, 10000);
  });

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton() || !interaction.customId.startsWith('giveaway_join_')) return;
    const messageId = interaction.customId.slice('giveaway_join_'.length);
    const fail = (text) => interaction.reply({ content: `🚫 **|** ${text}`, ephemeral: true }).catch(() => {});

    try {
      const g = await GiveawayController.get(messageId);
      if (!g || g.status !== 'active' || new Date() >= g.endTime) return fail('This giveaway is not active!');
      if (g.entries.some((e) => e.userId === interaction.user.id)) return fail('You are already in this giveaway!');

      const updated = await GiveawayController.join(messageId, interaction.user);
      if (!updated) return fail('You are already in this giveaway!');

      // Seperti OwO: pesan yang sama langsung diperbarui (jumlah Users bertambah)
      await interaction.update(GiveawayController.buildMessage(updated));
    } catch (error) {
      console.error('Giveaway join error:', error);
      if (!interaction.replied && !interaction.deferred) fail('Something went wrong, please try again.');
    }
  });
};
