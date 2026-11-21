const emojis = require('../customEmoji');
const crateDb = require('../battle/crateDb');
const cfg = require('../config');
const { sleep, displayName, onCooldown } = require('../utils');
const cooldown = require('../cooldown');
const { fail } = require('../battle/commandUtil');
const { weaponIcons } = require('../battle/weaponView');

const BLANK = cfg.EMOJI?.BLANK || '▫️';

// sbcrate [count|all] = buka boss weapon crate (hadiah guild boss)
module.exports = {
    name: 'bosscrate',
    aliases: ['bcrate', 'bc'],
    async execute(message, args) {
        const userId = message.author.id;
        const name = displayName(message);
        let count = 1;
        if (args[0] && args[0].toLowerCase() === 'all') {
            const doc = await crateDb.getCrate(userId);
            if (!doc.bossbox) return fail(message, "you don't have any boss weapon crates!");
            count = Math.min(doc.bossbox, crateDb.MAX_OPEN);
        } else if (args[0]) {
            if (!/^\d+$/.test(args[0])) return fail(message, `the correct command is \`${cfg.PREFIX}bosscrate {count|all}\`!`);
            count = Math.min(parseInt(args[0], 10), crateDb.MAX_OPEN);
            if (count <= 0) return fail(message, 'you must open more than one crate silly!', 3000);
        }
        if (onCooldown(message, 'bosscrate')) return;
        const have = (await crateDb.getCrate(userId)).bossbox || 0;
        if (have < count) return fail(message, "You don't have any boss weapon crates!", 3000);
        cooldown.start('bosscrate', userId);

        const head = count === 1 ? 'opens a boss weapon crate' : `opens ${count} boss weapon crates`;
        const sent = await message.channel.send({ content: `${BLANK} | **${name}** ${head}\n${emojis.bossCrateShake()} | and finds...`, allowedMentions: { parse: [] } }).catch(() => null);
        const [result] = await Promise.all([crateDb.openBossCrates(userId, count).catch(() => ({ error: 'fail' })), sleep(3000)]);
        if (!sent) return;
        if (result.error) return sent.edit("🚫 | You don't have any boss weapon crates!").catch(() => {});
        const weapons = result.weapons.sort((a, b) => b.avgQuality - a.avgQuality);
        const body = count === 1
            ? `\`${weapons[0].uwid}\` ${weaponIcons(weapons[0])} ${weapons[0].avgQuality}%`
            : weapons.map((w) => w.emoji).join('');
        return sent.edit({ content: `${BLANK} | **${name}** ${head}\n${emojis.bossCrateOpen()} | and finds ${count === 1 ? 'a ' : ': '}${body}`, allowedMentions: { parse: [] } }).catch(() => {});
    }
};
