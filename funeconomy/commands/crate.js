// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0 (https://github.com/ChristopherBThai/Discord-OwO-Bot)
const emojis = require('../customEmoji');
const crateDb = require('../battle/crateDb');
const { send, sleep, displayName, onCooldown } = require('../utils');
const cooldown = require('../cooldown');
const { fail } = require('../battle/commandUtil');
const { weaponIcons } = require('../battle/weaponView');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

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

        const result = await crateDb.openCrates(userId, count);
        if (result.error) return fail(message, "You don't have any weapon crates!", 3000);
        cooldown.start('crate', userId);
        const weapons = result.weapons;

        let text1;
        let text2;
        if (count === 1) {
            const w = weapons[0];
            text1 = `${BLANK} | **${name}** opens a weapon crate\n${emojis.crateShake()} | and finds a ...`;
            text2 = `${w.emoji} | **${name}** opens a weapon crate\n${emojis.crateOpen()} | and finds a \`${w.uwid}\` ${weaponIcons(w)} ${w.avgQuality}%`;
        } else {
            weapons.sort((a, b) => b.avgQuality - a.avgQuality);
            text1 = `${BLANK} | **${name}** opens ${count} weapon crates\n${emojis.crateShake()} | and finds...`;
            text2 = `${BLANK} | **${name}** opens ${count} weapon crates\n${emojis.crateOpen()} | and finds: ${weapons.map((w) => w.emoji).join('')}`;
        }
        const sent = await send(message, text1);
        await sleep(3000);
        // Tombol 🔍 membuka detail tiap senjata (ephemeral), urutan sama seperti daftar di pesan.
        const view = (id, disabled = false) => new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`fbattle:cv:${userId}:${id}:0:open`).setEmoji('🔍').setStyle(ButtonStyle.Secondary).setDisabled(disabled)
        );
        // Setelah 10 menit tombol 🔍 dimatikan (hasil crate di memori juga kedaluwarsa).
        const expireButton = (msg) => {
            const timer = setTimeout(() => msg.edit({ components: [view(msg.id, true)] }).catch(() => {}), crateDb.OPENED_TTL_MS);
            timer.unref?.();
        };
        const ids = weapons.map((w) => w.ruwid);
        const edited = await sent.edit({ content: text2, components: [view(sent.id)], allowedMentions: { parse: [] } }).catch(() => null);
        if (edited) { crateDb.rememberOpen(sent.id, userId, ids); expireButton(sent); }
        else {
            const fallback = await send(message, text2).catch(() => null);
            if (fallback) {
                crateDb.rememberOpen(fallback.id, userId, ids);
                await fallback.edit({ components: [view(fallback.id)] }).catch(() => {});
                expireButton(fallback);
            }
        }
    }
};
