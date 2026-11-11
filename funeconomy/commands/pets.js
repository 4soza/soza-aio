// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0 (https://github.com/ChristopherBThai/Discord-OwO-Bot)
const cfg = require('../config');
const Animal = require('../../models/funeconomy/animal');
const teamUtil = require('../battle/teamUtil');
const { EMBED_COLOR } = require('../battle/battleDisplay');
const { sendEmbed, canEmbed, send, onCooldown } = require('../utils');
const cooldown = require('../cooldown');
const { fail, userName } = require('../battle/commandUtil');

// spets = hewan yang pernah bertarung (punya XP), maks 25 teratas
module.exports = {
    name: 'pets',
    aliases: ['pet'],
    async execute(message, args) {
        if (args.length) return fail(message, 'Incorrect arguments');
        if (onCooldown(message, 'team')) return;
        cooldown.start('team', message.author.id);
        const userId = message.author.id;
        const docs = await Animal.find({ userId, xp: { $gt: 0 } }).sort({ xp: -1 }).limit(25).lean();
        const animals = await teamUtil.buildAnimals(userId, docs.map((d) => d.name), 0);
        // urutkan seperti dokumen (xp terbanyak dulu)
        animals.sort((a, b) => b.xp - a.xp);
        const title = `${userName(message.guild, message.author)}'s pets`;
        if (!animals.length) {
            return send(message, `🌱 | **${title}**, you have no pets yet! Put animals in your team with \`${cfg.PREFIX}team add {animal}\` and win battles.`);
        }
        const digits = teamUtil.statDigits(animals);
        const fields = [];
        let letters = title.length;
        for (const a of animals) {
            const field = { name: `${a.animal.uni} ${a.nickname}`.slice(0, 256), value: teamUtil.statBlock(a, digits), inline: true };
            letters += field.name.length + field.value.length;
            if (letters > 5800) break;
            fields.push(field);
        }
        if (!canEmbed(message)) {
            return send(message, `**${title}**\n${animals.map((a) => `${a.animal.uni} ${a.nickname} Lvl.${a.stats.lvl}`).join('\n')}`);
        }
        return sendEmbed(message, { color: EMBED_COLOR, author: { name: title }, fields });
    }
};
