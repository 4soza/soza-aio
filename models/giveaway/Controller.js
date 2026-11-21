// Giveaway ala OwO: satu embed + satu tombol "Join Giveaway!".
// Pesan asli selalu diedit (tidak ada pesan "ended" terpisah).
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ms = require('ms');
const Giveaway = require('./schema');

const COLOR_ACTIVE = 8240363; // biru OwO
const COLOR_ENDED = 6381923; // abu OwO

function unix(date) {
  return Math.floor(new Date(date).getTime() / 1000);
}

class GiveawayController {
  // ===== Tampilan =====
  static buildMessage(g) {
    const ended = g.status !== 'active';
    const noWinners = ended && !(g.winnersList && g.winnersList.length);
    const count = g.entries ? g.entries.length : 0;

    let text = `**${g.winners} Lucky User${g.winners === 1 ? '' : 's'}** will have a chance to win!\nWinners will win:\n\n**• ${g.prize}**\n`;
    if (!ended) {
      text += `\nGiveaway will end **<t:${unix(g.endTime)}:R>**\nGoodluck to those who join!`;
    } else if (noWinners) {
      text += `\nGiveaway ended **<t:${unix(g.endTime)}:R>**\nUnfortunately, there were no winners.`;
    } else {
      text += `\nGiveaway ended **<t:${unix(g.endTime)}:R>**\nCongrats to the following players for winning!\n\n`;
      text += g.winnersList.map((w) => `<@${w.userId}>`).join('\n');
    }

    const embed = new EmbedBuilder()
      .setColor(ended ? COLOR_ENDED : COLOR_ACTIVE)
      .setAuthor({ name: ended ? '🎉 Giveaway has ended!' : '🎉 A New Giveaway Appeared!' })
      .setDescription(text.slice(0, 4000))
      .setFooter({ text: `${count} Users` })
      .setTimestamp();

    const button = new ButtonBuilder()
      .setCustomId(`giveaway_join_${g.messageId}`)
      .setLabel('Join Giveaway!')
      .setEmoji('🎉')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(ended);

    return { content: '', embeds: [embed], components: [new ActionRowBuilder().addComponents(button)] };
  }

  static async refresh(client, g) {
    try {
      const channel = await client.channels.fetch(g.channelId);
      const message = await channel.messages.fetch(g.messageId);
      await message.edit(this.buildMessage(g));
      return true;
    } catch (error) {
      console.error('Giveaway refresh error:', error.message);
      return false;
    }
  }

  // ===== Data =====
  static parseDuration(text) {
    const value = ms(String(text).trim());
    if (!value || value < 10000 || value > 30 * 24 * 3600 * 1000) return null;
    return value;
  }

  static async create({ channel, hostId, prize, durationMs, winners }) {
    const placeholder = new Giveaway({
      messageId: 'pending', guildId: channel.guild.id, channelId: channel.id, hostId,
      prize, winners, endTime: new Date(Date.now() + durationMs)
    });
    const message = await channel.send(this.buildMessage(placeholder));
    placeholder.messageId = message.id;
    try {
      await placeholder.save();
    } catch (error) {
      await message.delete().catch(() => {});
      throw error;
    }
    await message.edit(this.buildMessage(placeholder)).catch(() => {}); // pasang id tombol yang benar
    return { giveaway: placeholder, message };
  }

  static get(messageId) {
    return Giveaway.findOne({ messageId });
  }

  static activeInChannel(channelId) {
    return Giveaway.findOne({ channelId, status: 'active' });
  }

  static list(guildId, status = 'active') {
    return Giveaway.find({ guildId, status }).sort({ endTime: 1 }).limit(25);
  }

  static expired() {
    return Giveaway.find({ status: 'active', endTime: { $lte: new Date() } });
  }

  // Join: atomik, hanya berhasil kalau belum ada di entries dan giveaway masih aktif
  static async join(messageId, user) {
    return Giveaway.findOneAndUpdate(
      { messageId, status: 'active', endTime: { $gt: new Date() }, 'entries.userId': { $ne: user.id } },
      { $push: { entries: { userId: user.id, username: user.username } } },
      { new: true }
    );
  }

  static pickWinners(g, count = g.winners) {
    const pool = g.entries.map((e) => ({ userId: e.userId, username: e.username }));
    const picked = [];
    while (picked.length < count && pool.length) {
      picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    return picked;
  }

  static async dmWinners(client, g, winners) {
    const link = `https://discord.com/channels/${g.guildId}/${g.channelId}/${g.messageId}`;
    for (const w of winners) {
      try {
        const user = await client.users.fetch(w.userId);
        await user.send(`🎉 **|** Congratulations! You won the giveaway in ${link}`);
      } catch (error) { /* DM ditutup, abaikan */ }
    }
  }

  // Akhiri giveaway: pilih pemenang, edit pesan asli, DM pemenang
  static async end(client, messageId) {
    const g = await Giveaway.findOneAndUpdate(
      { messageId, status: 'active' }, { $set: { status: 'ended' } }, { new: true }
    );
    if (!g) return null;
    g.winnersList = this.pickWinners(g);
    await g.save();
    await this.refresh(client, g);
    if (g.settings?.dmWinners !== false) await this.dmWinners(client, g, g.winnersList);
    return g;
  }

  static async reroll(client, messageId, count) {
    const g = await Giveaway.findOne({ messageId, status: 'ended' });
    if (!g) return null;
    g.winnersList = this.pickWinners(g, count || g.winners);
    await g.save();
    await this.refresh(client, g);
    if (g.settings?.dmWinners !== false) await this.dmWinners(client, g, g.winnersList);
    return g;
  }

  static async remove(client, messageId) {
    const g = await Giveaway.findOneAndDelete({ messageId });
    if (!g) return null;
    try {
      const channel = await client.channels.fetch(g.channelId);
      const message = await channel.messages.fetch(g.messageId);
      await message.delete();
    } catch (error) { /* pesan sudah hilang */ }
    return g;
  }
}

module.exports = GiveawayController;
