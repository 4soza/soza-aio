/*
 * Tampilan dan tombol guild boss (Components V2), terinspirasi OwO Bot:
 * "A Guild Boss Appeared!" + gambar 3 kartu + Top 10 Damage + Rewards + tombol Fight!
 */
const GuildBoss = require('../../models/funeconomy/guildBoss');
const emojis = require('../customEmoji');
const cfg = require('../config');
const teamUtil = require('../battle/teamUtil');
const settingsDb = require('../battle/settingsDb');
const { displayBattle } = require('../battle/battleDisplay');
const bossService = require('./bossService');
const { renderBossCards } = require('./bossCard');

const BUTTON_PREFIX = 'fboss';
const V2 = 32768;
const COLOR = 0x7ab8f5;
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const cap = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);
const text = (content) => ({ type: 10, content });
const sep = () => ({ type: 14, divider: true, spacing: 1 });
const btn = (o) => ({ type: 2, ...o });
const running = new Set(); // satu pertarungan boss per user pada satu waktu

function ticketIcons(left) {
    const t = emojis.bossTicket();
    return Array.from({ length: bossService.CONFIG.TICKETS_PER_DAY }, (_, i) => (i < left ? t : '▫️')).join(' ');
}

/* Isi pesan boss: { components, files, flags }. */
async function render(doc) {
    const active = doc.status === 'active' && doc.endsAt.getTime() > Date.now();
    const animals = bossService.buildAnimals(doc);
    const defeated = await bossService.defeatedCount(doc.guildId);

    let files = [];
    let picture;
    try {
        const png = await renderBossCards(animals);
        files = [{ attachment: png, name: 'boss.png' }];
        picture = { type: 12, items: [{ media: { url: 'attachment://boss.png' } }] };
    } catch (error) {
        console.error('[BOSS] Could not render boss image:', error.message);
        picture = text(animals.map((a) => `Lvl ${a.stats.lvl} **${cap(a.animal.rank)} ${a.animal.name}** — \`${fmt(Math.max(0, a.stats.hp[0]))}/${fmt(a.stats.hp[1] + a.stats.hp[3])} HP\``).join('\n'));
    }

    const title = active ? 'A Guild Boss Appeared!' : (doc.status === 'defeated' ? 'The Guild Boss was defeated!' : 'The Guild Boss ran away!');
    const top = bossService.topDamage(doc, 10);
    const board = top.length
        ? `\`Rank Damage Username\`\n${top.map((e, i) => `\`${String(i + 1).padEnd(4)} ${fmt(e.damage).padEnd(6)}\` <@${e.userId}>`).join('\n')}`
        : 'No damage dealt yet...';
    const r = doc.rewards;
    const rewards = [
        `${emojis.shard()} **${fmt(r.shards)}** Weapon Shards`,
        `${emojis.crate()} **${r.crates}** Weapon Crate`,
        `${emojis.bossCrate()} **${r.bossCrates}** Boss Weapon Crate`,
        `⭐ **${fmt(r.xp)}** Experience`
    ].join('  •  ');
    const endUnix = Math.floor(doc.endsAt.getTime() / 1000);
    const footer = `${active ? `⏳ runs away <t:${endUnix}:R>` : '⏳ no longer here'}   ⚔️ **${doc.fighters.length}** fighters   💀 **${defeated}** defeated`;

    const container = {
        type: 17,
        accent_color: COLOR,
        components: [
            {
                type: 9,
                components: [text(`## 👹 ${title}`)],
                accessory: btn({ style: 2, custom_id: `${BUTTON_PREFIX}:info:${doc._id}`, emoji: emojis.button(emojis.get('search')) })
            },
            picture,
            sep(),
            text(`### Top 10 Damage Dealt\n${board}`),
            sep(),
            text(`### Rewards\n${rewards}`),
            sep(),
            {
                type: 9,
                components: [text(footer)],
                accessory: btn({ style: 3, label: 'Fight!', custom_id: `${BUTTON_PREFIX}:fight:${doc._id}`, emoji: emojis.button(emojis.bossTicket()), disabled: !active })
            }
        ]
    };
    return { components: [container], files, flags: V2, allowedMentions: { parse: [] } };
}

async function refreshMessage(message, doc) {
    if (!message) return;
    const payload = await render(doc);
    await message.edit({ ...payload, attachments: [] }).catch((error) => console.error('[BOSS] Could not update boss message:', error.message));
}

/* Detail boss (tombol 🔍): hewan, HP, senjata, dan passive. */
async function showInfo(interaction, bossId) {
    const doc = await GuildBoss.findById(bossId);
    if (!doc) return interaction.reply({ content: '🚫 | This boss is no longer here!', ephemeral: true });
    const embeds = bossService.buildAnimals(doc).map((a) => {
        const lines = [`HP: **${fmt(Math.max(0, a.stats.hp[0]))} / ${fmt(a.stats.hp[1] + a.stats.hp[3])}**`];
        if (a.weapon) {
            lines.push(`\n**${a.weapon.rank?.emoji || ''} ${a.weapon.name}** (${a.weapon.avgQuality}%)\n${a.weapon.desc || ''}`);
            for (const p of a.weapon.passives || []) lines.push(`${p.emoji} **${p.name}** - ${p.desc || ''}`);
        }
        return { color: COLOR, title: `Lvl ${a.stats.lvl} ${cap(a.animal.rank)} ${a.animal.name}`, description: lines.join('\n').slice(0, 4000) };
    });
    return interaction.reply({ embeds, ephemeral: true });
}

const confirmRow = (bossId, messageId, disabled = false) => ({
    type: 1,
    components: [
        btn({ style: 3, label: 'Fight!', custom_id: `${BUTTON_PREFIX}:yes:${bossId}:${messageId}`, emoji: { name: '✔️' }, disabled }),
        btn({ style: 4, label: 'Cancel', custom_id: `${BUTTON_PREFIX}:no:${bossId}`, emoji: { name: '✖️' }, disabled })
    ]
});

async function startFight(interaction, bossId, { confirmed = false, messageId = null } = {}) {
    const userId = interaction.user.id;
    const name = interaction.member?.displayName || interaction.user.username;
    const channel = interaction.channel || await interaction.client.channels.fetch(interaction.channelId).catch(() => null);
    const bossMessage = confirmed
        ? await channel?.messages.fetch(messageId).catch(() => null)
        : interaction.message;
    const ephemeral = (content) => interaction.reply({ content, ephemeral: true });

    const doc = await GuildBoss.findById(bossId);
    if (!doc || doc.status !== 'active' || doc.endsAt.getTime() <= Date.now()) {
        if (doc) await refreshMessage(bossMessage, doc);
        return ephemeral('🚫 | This boss is no longer here! Use `' + cfg.PREFIX + 'boss` to see the next one.');
    }
    if (running.has(userId)) return ephemeral('🚫 | You are already fighting the boss!');

    const team = await teamUtil.getBattleTeam(userId);
    if (!team) return ephemeral(`🚫 | Create a team with the command \`${cfg.PREFIX}team add {animal}\``);

    const already = doc.fighters.includes(userId);
    if (already && !confirmed) {
        const left = await bossService.ticketsLeft(userId);
        if (left <= 0) return ephemeral(`${emojis.bossTicket()} | **${name}**, you already fought this boss and have no boss tickets left! Tickets reset every day.`);
        return interaction.reply({
            content: `${emojis.bossTicket()} | **${name}**, you already fought this boss!\nAre you sure you want to use another boss ticket?\nYou only have **${left}/${bossService.CONFIG.TICKETS_PER_DAY}** tickets left: ${ticketIcons(left)}`,
            components: [confirmRow(bossId, interaction.message?.id || '0')],
            ephemeral: true
        });
    }
    let paid = false;
    if (already) {
        paid = await bossService.useTicket(userId);
        if (!paid) return interaction.update({ content: `${emojis.bossTicket()} | **${name}**, you have no boss tickets left!`, components: [] });
    }

    running.add(userId);
    try {
        if (confirmed) await interaction.update({ content: `${emojis.bossTicket()} | **${name}**, you decided to fight!`, components: [confirmRow(bossId, messageId, true)] });
        else await interaction.deferUpdate();

        const result = await bossService.fight({ bossId, userId, playerTeam: team, playerName: name });
        if (result.error) {
            if (paid) await bossService.refundTicket(userId);
            return channel?.send({ content: `🚫 | **${name}**, the boss is no longer here!`, allowedMentions: { parse: [] } });
        }
        const setting = await settingsDb.getBattleSetting(userId);
        await displayBattle(result.event, setting,
            (embed, files) => channel.send({ embeds: [embed], files, allowedMentions: { parse: [] } }),
            { title: `${name} fights the Guild Boss!`, iconURL: interaction.user.displayAvatarURL?.({ extension: 'png', size: 64 }) });

        await refreshMessage(bossMessage, result.doc);
        if (result.finished) {
            const r = result.doc.rewards;
            await channel.send({
                content: `🎉 | **${name}** defeated the Guild Boss! **${result.rewardedCount}** fighters received ${emojis.shard()} **${fmt(r.shards)}**, ${emojis.crate()} **${r.crates}**, ${emojis.bossCrate()} **${r.bossCrates}** and ⭐ **${fmt(r.xp)}** xp. A new boss will appear with \`${cfg.PREFIX}boss\`!`,
                allowedMentions: { parse: [] }
            });
        }
    } finally {
        running.delete(userId);
    }
}

async function handleButton(interaction) {
    const [, action, bossId, extra] = interaction.customId.split(':');
    try {
        if (action === 'info') return await showInfo(interaction, bossId);
        if (action === 'fight') return await startFight(interaction, bossId);
        if (action === 'yes') return await startFight(interaction, bossId, { confirmed: true, messageId: extra });
        if (action === 'no') return await interaction.update({ content: 'Cancelled.', components: [] });
    } catch (error) {
        console.error('[BOSS] Button failed:', error);
        const body = { content: '🚫 | Something went wrong, please try again.', ephemeral: true };
        if (interaction.deferred || interaction.replied) await interaction.followUp(body).catch(() => {});
        else await interaction.reply(body).catch(() => {});
    }
}

module.exports = { BUTTON_PREFIX, render, refreshMessage, handleButton, ticketIcons };
