// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0 (https://github.com/ChristopherBThai/Discord-OwO-Bot)
const emojis = require('../customEmoji');
const crateDb = require('../battle/crateDb');
const { send, sleep, displayName, onCooldown } = require('../utils');
const cooldown = require('../cooldown');
const { fail } = require('../battle/commandUtil');
const { weaponIcons } = require('../battle/weaponView');

const BLANK = '▫️';

// scrate [count|all] = buka weapon crate (dari hadiah battle)
module.exports = {
    name: 'crate',
    aliases: ['weaponcrate', 'wc'],
    async execute(message, args) {
        const userId = message.author.id;
        const name = displayName(message);
        let count = 1;
        if (args[0] && args[0].toLowerCase() === 'all') {
            const doc = await crateDb.getCrate(userId);
            if (!doc.boxcount) return fail(message, "you don't have any more weapon crates!");
            count = Math.min(doc.boxcount, crateDb.MAX_OPEN);
        } else if (args[0]) {
            if (!/^\d+$/.test(args[0])) return fail(message, `the correct command is \`${require('../config').PREFIX}crate {count|all}\`!`);
            count = parseInt(args[0], 10);
            if (count <= 0) return fail(message, 'you must open more than one crate silly!', 3000);
            count = Math.min(count, crateDb.MAX_OPEN);
        }
        if (onCooldown(message, 'crate')) return;

        // Cek saldo cepat (1 baca DB) supaya pesan pertama bisa langsung muncul, tidak menunggu penyimpanan senjata.
        const have = (await crateDb.getCrate(userId)).boxcount || 0;
        if (have < count) return fail(message, "You don't have any weapon crates!", 3000);
        cooldown.start('crate', userId);

        const text1 = count === 1
            ? `${BLANK} | **${name}** opens a weapon crate\n${emojis.crateShake()} | and finds a ...`
            : `${BLANK} | **${name}** opens ${count} weapon crates\n${emojis.crateShake()} | and finds...`;
        // Pesan memakai Components V2 supaya tombol 🔍 tampil di samping teks (seperti OwO).
        const V2 = 32768;
        const lines = (t) => ({ type: 10, content: t });
        const sent = await message.channel.send({ components: [lines(text1)], flags: V2, allowedMentions: { parse: [] } }).catch(() => null);
        // Penyimpanan senjata berjalan sambil menunggu 3 detik animasi.
        const [result] = await Promise.all([crateDb.openCrates(userId, count).catch(() => ({ error: 'fail' })), sleep(3000)]);
        if (!sent) return;
        if (result.error) return sent.edit({ components: [lines("🚫 | You don't have any weapon crates!")], flags: V2 }).catch(() => {});
        const weapons = result.weapons;
        let text2;
        if (count === 1) {
            const w = weapons[0];
            text2 = `${w.emoji} | **${name}** opens a weapon crate\n${emojis.crateOpen()} | and finds a \`${w.uwid}\` ${weaponIcons(w)} ${w.avgQuality}%`;
        } else {
            weapons.sort((a, b) => b.avgQuality - a.avgQuality);
            text2 = `${BLANK} | **${name}** opens ${count} weapon crates\n${emojis.crateOpen()} | and finds: ${weapons.map((w) => w.emoji).join('')}`;
        }
        // Tombol 🔍 membuka detail tiap senjata (ephemeral), urutan sama seperti daftar di pesan.
        const view = (id, disabled = false) => ({
            type: 9,
            components: [lines(text2)],
            accessory: { type: 2, style: 2, custom_id: `fbattle:cv:${userId}:${id}:0:open`, emoji: emojis.button(emojis.get('search')), disabled }
        });
        // Setelah 10 menit tombol 🔍 dimatikan (hasil crate di memori juga kedaluwarsa).
        const expireButton = (msg) => {
            const timer = setTimeout(async () => {
                // Kalau 🔍 sudah diklik, pesan ini sudah berganti jadi detail senjata: jangan ditimpa.
                const fresh = await msg.fetch().catch(() => null);
                const id = fresh?.components?.[0]?.accessory?.customId || '';
                if (id.startsWith('fbattle:cv:') && id.endsWith(':open')) msg.edit({ components: [view(msg.id, true)], flags: V2 }).catch(() => {});
            }, crateDb.OPENED_TTL_MS);
            timer.unref?.();
        };
        const ids = weapons.map((w) => w.ruwid);
        const edited = await sent.edit({ components: [view(sent.id)], flags: V2, allowedMentions: { parse: [] } }).catch(() => null);
        if (edited) { crateDb.rememberOpen(sent.id, userId, ids); expireButton(sent); }
        else {
            const fallback = await message.channel.send({ components: [view('0')], flags: V2, allowedMentions: { parse: [] } }).catch(() => null);
            if (fallback) {
                crateDb.rememberOpen(fallback.id, userId, ids);
                await fallback.edit({ components: [view(fallback.id)], flags: V2 }).catch(() => {});
                expireButton(fallback);
            }
        }
    }
};
