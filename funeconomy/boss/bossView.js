/*
 * Tampilan dan tombol guild boss (Components V2), terinspirasi OwO Bot:
 * "A Guild Boss Appeared!" + gambar 3 kartu + Top 10 Damage + Rewards + tombol Fight!
 */
const GuildBoss = require('../../models/funeconomy/guildBoss');
const emojis = require('../customEmoji');
const cfg = require('../config');
const teamUtil = require('../battle/teamUtil');
const bossService = require('./bossService');
const { renderBossCards, renderBossAnimal } = require('./bossCard');
const WeaponInterface = require('../battle/WeaponInterface');

const path = require('path');
const BUTTON_PREFIX = 'fboss';
const ASSETS = path.join(__dirname, '..', '..', 'assets');
// Gambar kanan atas pada pesan konfirmasi: tanya = sell.png, setuju = fight.png, batal = cancel.png
const PICS = { ask: ['boss/ask.png', 'ask.png'], yes: ['boss/fight.png', 'fight.png'], no: ['boss/cancel.png', 'cancel.png'] };
const CONFIRM_COLOR = { ask: 0x7dbceb, yes: 0x00ff00, no: 0xff0000 };
const EPHEMERAL = 64;
const INACTIVE_MS = 10 * 60 * 1000; // setelah 10 menit pesan boss jadi abu-abu dan tombolnya mati
const GREY = 0x4f545c;
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
    return Array.from({ length: bossService.CONFIG.TICKETS_PER_DAY }, (_, i) => (i < left ? t : emojis.bossTicketUsed())).join(' ');
}

/* Isi pesan boss: { components, files, flags }. */
async function render(doc, { inactive = false } = {}) {
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
    const width = Math.max(6, ...top.map((e) => fmt(e.damage).length));
    const head = ['Rank', 'Damage', 'Username'].map((h) => `__**\`${h}\`**__`).join(' ');
    const board = top.length
        ? `${head}\n${top.map((e, i) => `**\`${String(i + 1).padEnd(4)}\`** \`${fmt(e.damage).padStart(width)}\` <@${e.userId}>`).join('\n')}`
        : `${head}\nNo damage dealt yet...`;
    const r = doc.rewards;
    const rewards = [
        `${emojis.shard()} **${fmt(r.shards)}** Weapon Shards`,
        `${emojis.crate()} **${r.crates}** Weapon Crate`,
        `${emojis.bossCrate()} **${r.bossCrates}** Boss Weapon Crate`,
        `⭐ **${fmt(r.xp)}** Experience`
    ].join('  •  ');
    const endUnix = Math.floor(doc.endsAt.getTime() / 1000);
    const footer = `${emojis.bossTime()} ${active ? `runs away <t:${endUnix}:R>` : 'no longer here'}   ${emojis.bossFighters()} **${doc.fighters.length}** fighters   ${emojis.bossDefeated()} **${defeated}** defeated`;

    const container = {
        type: 17,
        accent_color: inactive ? GREY : COLOR,
        components: [
            {
                type: 9,
                components: [text(`## ${emojis.bossShock()} ${title}`)],
                accessory: btn({ style: 2, custom_id: `${BUTTON_PREFIX}:info:${doc._id}`, emoji: emojis.button(emojis.get('search')), disabled: inactive })
            },
            picture,
            sep(),
            {
                type: 9,
                components: [text(`### Top 10 Damage Dealt\n${board}`)],
                accessory: btn({ style: 2, custom_id: `${BUTTON_PREFIX}:stats:${doc._id}`, emoji: emojis.button(emojis.bossStats()), disabled: inactive })
            },
            sep(),
            text(`### Rewards\n${rewards}`),
            sep(),
            {
                type: 9,
                components: [text(footer)],
                accessory: btn({ style: 3, label: 'Fight!', custom_id: `${BUTTON_PREFIX}:fight:${doc._id}`, emoji: emojis.button(emojis.bossTicket()), disabled: !active || inactive })
            }
        ]
    };
    return { components: [container], files, flags: V2, allowedMentions: { parse: [] } };
}

const isStale = (message) => !!message && Date.now() - message.createdTimestamp >= INACTIVE_MS;

async function refreshMessage(message, doc) {
    if (!message) return;
    const payload = await render(doc, { inactive: isStale(message) });
    await message.edit({ ...payload, attachments: [] }).catch((error) => console.error('[BOSS] Could not update boss message:', error.message));
}

/* 10 menit setelah pesan boss dikirim: ubah jadi abu-abu dan matikan semua tombol. */
function scheduleInactive(message, bossId) {
    const timer = setTimeout(async () => {
        try {
            const doc = await GuildBoss.findById(bossId);
            if (!doc) return;
            const payload = await render(doc, { inactive: true });
            await message.edit({ ...payload, attachments: [] });
        } catch (error) {
            console.error('[BOSS] Could not deactivate boss message:', error.message);
        }
    }, Math.max(0, INACTIVE_MS - (Date.now() - message.createdTimestamp)));
    timer.unref?.();
}

/* Tombol halaman: ◀ n/N ▶ (ikon panah sama seperti daftar senjata). */
function pageRow(prefix, bossId, page, total, { edges = false } = {}) {
    const b = (id, emoji, to, off) => btn({ style: 2, custom_id: `${BUTTON_PREFIX}:${prefix}:${bossId}:${to}:${id}`, emoji: emojis.button(emoji), disabled: off });
    const row = [];
    if (edges) row.push(b('first', emojis.get('nav_first'), 0, page <= 0));
    row.push(b('prev', emojis.get('nav_prev'), Math.max(0, page - 1), page <= 0));
    row.push(btn({ style: 2, label: `${page + 1}/${total}`, custom_id: `${BUTTON_PREFIX}:noop:${bossId}:${prefix}`, disabled: true }));
    row.push(b('next', emojis.get('nav_next'), Math.min(total - 1, page + 1), page >= total - 1));
    if (edges) row.push(b('last', emojis.get('nav_last'), total - 1, page >= total - 1));
    return { type: 1, components: row };
}

function emojiImageUrl(emoji) {
    const m = /^<(a?):\w+:(\d+)>$/.exec(emoji || '');
    return m ? `https://cdn.discordapp.com/emojis/${m[2]}.${m[1] ? 'gif' : 'png'}?size=128` : null;
}

/* Detail satu hewan boss (tombol 🔍), satu halaman per hewan seperti OwO. */
async function showInfo(interaction, bossId, index = 0, update = false) {
    const doc = await GuildBoss.findById(bossId);
    if (!doc) return interaction.reply({ content: '🚫 | This boss is no longer here!', flags: EPHEMERAL });
    const animals = bossService.buildAnimals(doc);
    const page = Math.min(Math.max(0, index), animals.length - 1);
    const a = animals[page];
    const s = a.stats;
    const i = (k) => emojis.get(`stat_${k}`);
    const pct = (v) => WeaponInterface.resToPrettyPercent(v);
    const statRow = [
        [i('hp'), fmt(s.hp[1] + s.hp[3])], [i('wp'), fmt(s.wp[1] + s.wp[3])], [i('str'), fmt(s.att[0] + s.att[1])],
        [i('pr'), pct(s.pr)], [i('mag'), fmt(s.mag[0] + s.mag[1])], [i('mr'), pct(s.mr)]
    ].map(([e, v]) => `${e} \`${v}\``).join(' ');

    const components = [text(`### Lvl ${s.lvl} ${cap(a.animal.rank)} ${a.animal.name}`)];
    const files = [];
    try {
        files.push({ attachment: await renderBossAnimal(a), name: 'boss_animal.png' });
        components.push({ type: 12, items: [{ media: { url: 'attachment://boss_animal.png' } }] });
    } catch (error) {
        console.error('[BOSS] Could not render animal image:', error.message);
        components.push(text(`${a.animal.uni || a.animal.value} **${fmt(Math.max(0, s.hp[0]))} / ${fmt(s.hp[1] + s.hp[3])}**`));
    }
    components.push(text(`${statRow}\n${a.animal.desc || ''}`.trim()));

    const w = a.weapon;
    if (w) {
        const cost = Math.ceil(w.manaCost || 0);
        const head = [
            `**${w.fullName || w.name}**`,
            `Quality: ${w.rank?.emoji || ''} ${w.avgQuality}%`,
            `Wear: \`${String(w.wearName || '').toUpperCase()}\``,
            'Type: `BOSS`',
            ...(w.hasTakedownTracker ? [`Kills: \`${Number(w.kills || 0).toLocaleString('en-US')}\``] : []),
            `Weapon Cost: ${cost > 0 ? `${cost} ${WeaponInterface.wpEmoji}` : 'no cost'}`
        ].join('\n');
        const image = emojiImageUrl(w.emoji);
        components.push(sep());
        components.push(image
            ? { type: 9, components: [text(head)], accessory: { type: 11, media: { url: image } } }
            : text(head));
        const more = [`__**Description**__\n${w.desc || ''}`];
        for (const buff of (w.buffList?.length ? w.getBuffs() : [])) more.push(`${buff.emoji} **${buff.name}** - ${buff.desc}`);
        for (const p of w.passives || []) more.push(`${p.emoji} **${p.name}** - ${p.desc || ''}`);
        components.push(text(more.join('\n').slice(0, 3500)));
    }
    components.push(pageRow('ip', bossId, page, animals.length));
    const payload = { components: [{ type: 17, accent_color: COLOR, components }], files, flags: V2 };
    if (update) return interaction.update({ ...payload, attachments: [] });
    return interaction.reply({ ...payload, flags: V2 | EPHEMERAL });
}

/* Pesan konfirmasi ala OwO: kotak berwarna, gambar di atas, teks, lalu tombol (Components V2). */
function confirmMessage(kind, text, { bossId, messageId = '0', disabled = false, buttons = true } = {}) {
    const [file, name] = PICS[kind];
    return {
        components: [{ type: 17, accent_color: CONFIRM_COLOR[kind], components: [{ type: 12, items: [{ media: { url: `attachment://${name}` } }] }, { type: 10, content: text }, ...(buttons ? [confirmRow(bossId, messageId, disabled)] : [])] }],
        files: [{ attachment: path.join(ASSETS, file), name }],
        flags: V2
    };
}

/* Tombol grafik: "Current boss leaderboard" 10 per halaman (⏪ ◀ n/N ▶ ⏩). */
const LB_PER_PAGE = 10;
async function showLeaderboard(interaction, bossId, pageIndex = 0, update = false) {
    const doc = await GuildBoss.findById(bossId);
    if (!doc) return interaction.reply({ content: '🚫 | This boss is no longer here!', flags: EPHEMERAL });
    const all = bossService.topDamage(doc, 1000);
    const total = Math.max(1, Math.ceil(all.length / LB_PER_PAGE));
    const page = Math.min(Math.max(0, pageIndex), total - 1);
    const rows = all.slice(page * LB_PER_PAGE, (page + 1) * LB_PER_PAGE);
    const width = Math.max(6, ...rows.map((e) => fmt(e.damage).length));
    const head = ['Rank', 'Damage', 'Username'].map((h) => `__**\`${h}\`**__`).join(' ');
    const body = rows.length
        ? rows.map((e, k) => `**\`${String(page * LB_PER_PAGE + k + 1).padEnd(4)}\`** \`${fmt(e.damage).padStart(width)}\` <@${e.userId}>`).join('\n')
        : 'No damage dealt yet...';
    const icon = interaction.client?.user?.displayAvatarURL?.({ extension: 'png', size: 64 });
    // Embed biasa (judul kecil dengan ikon di atas, seperti "goes into battle!"), waktu di footer.
    const payload = {
        embeds: [{
            color: COLOR,
            author: { name: 'Current boss leaderboard', ...(icon ? { icon_url: icon } : {}) },
            description: `${head}\n${body}`,
            footer: { text: 'Updated on' },
            timestamp: new Date().toISOString()
        }],
        components: [pageRow('lb', bossId, page, total)]
    };
    if (update) return interaction.update(payload);
    return interaction.reply({ ...payload, flags: EPHEMERAL });
}

const confirmRow = (bossId, messageId, disabled = false) => ({
    type: 1,
    components: [
        btn({ style: 3, label: 'Fight!', custom_id: `${BUTTON_PREFIX}:yes:${bossId}:${messageId}`, emoji: emojis.button(emojis.get('check')), disabled }),
        btn({ style: 4, label: 'Cancel', custom_id: `${BUTTON_PREFIX}:no:${bossId}`, emoji: emojis.button(emojis.get('cross')), disabled })
    ]
});

async function startFight(interaction, bossId, { confirmed = false, messageId = null } = {}) {
    const userId = interaction.user.id;
    const name = interaction.member?.displayName || interaction.user.username;
    const channel = interaction.channel || await interaction.client.channels.fetch(interaction.channelId).catch(() => null);
    const bossMessage = confirmed
        ? await channel?.messages.fetch(messageId).catch(() => null)
        : interaction.message;
    const ephemeral = (content) => interaction.reply({ content, flags: EPHEMERAL });

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
        const ask = confirmMessage('ask', `### ${emojis.bossTicket()}, you already fought this boss!\nAre you sure you want to use another boss ticket?\nYou only have **${left}/${bossService.CONFIG.TICKETS_PER_DAY}** tickets left: ${ticketIcons(left)}`, { bossId, messageId: interaction.message?.id || '0' });
        return interaction.reply({ ...ask, flags: V2 | EPHEMERAL });
    }
    let paid = false;
    if (already) {
        paid = await bossService.useTicket(userId);
        if (!paid) return interaction.update(confirmMessage('no', `### ${emojis.bossTicket()}, you have no boss tickets left!`, { bossId, messageId, disabled: true }));
    }

    running.add(userId);
    try {
        if (confirmed) {
            await interaction.update({ ...confirmMessage('yes', `### ${emojis.bossTicket()}, you decided to fight!`, { bossId, messageId, disabled: true }), attachments: [] });
        }
        else await interaction.deferUpdate();

        const result = await bossService.fight({ bossId, userId, playerTeam: team, playerName: name });
        if (result.error) {
            if (paid) await bossService.refundTicket(userId);
            return channel?.send({ content: `🚫 | **${name}**, the boss is no longer here!`, allowedMentions: { parse: [] } });
        }
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
        // Tombol di pesan boss yang sudah lewat 10 menit (mis. bot sempat restart): matikan saja.
        if (['info', 'stats', 'fight'].includes(action) && isStale(interaction.message)) {
            const doc = await GuildBoss.findById(bossId);
            if (doc) return await interaction.update({ ...(await render(doc, { inactive: true })), attachments: [] });
            return await interaction.reply({ content: '🚫 | This boss is no longer here!', flags: EPHEMERAL });
        }
        if (action === 'info') return await showInfo(interaction, bossId);
        if (action === 'ip') return await showInfo(interaction, bossId, Number(extra) || 0, true);
        if (action === 'stats') return await showLeaderboard(interaction, bossId);
        if (action === 'lb') return await showLeaderboard(interaction, bossId, Number(extra) || 0, true);
        if (action === 'noop') return await interaction.deferUpdate();
        if (action === 'fight') return await startFight(interaction, bossId);
        if (action === 'yes') return await startFight(interaction, bossId, { confirmed: true, messageId: extra });
        if (action === 'no') {
            return await interaction.update({ ...confirmMessage('no', `### ${emojis.bossTicket()}, you decided not to fight`, { bossId, disabled: true }), attachments: [] });
        }
    } catch (error) {
        console.error('[BOSS] Button failed:', error);
        const body = { content: '🚫 | Something went wrong, please try again.', flags: EPHEMERAL };
        if (interaction.deferred || interaction.replied) await interaction.followUp(body).catch(() => {});
        else await interaction.reply(body).catch(() => {});
    }
}

module.exports = { BUTTON_PREFIX, render, refreshMessage, scheduleInactive, handleButton, ticketIcons };
