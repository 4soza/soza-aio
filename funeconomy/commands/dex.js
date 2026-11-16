// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
const { fmt, displayName, send, sendTemporaryError, onCooldown } = require('../utils');
const cooldown = require('../cooldown');
const { RANKS } = require('../zoo/data');
const { findAnimal } = require('../zoo/data');
const { getAnimalDoc } = require('../zoo/zooDb');
const WeaponInterface = require('../battle/WeaponInterface');
const { classOf, weaponIdsFor } = require('../battle/animalClass');

const err = (message, name, text) => sendTemporaryError(message, `**🚫 | ${name}**, ${text}`);

async function totalCaught(key) {
    try {
        const Animal = require('../../models/funeconomy/animal');
        const rows = await Animal.aggregate([{ $match: { name: key } }, { $group: { _id: null, total: { $sum: '$totalcount' } } }]);
        return rows[0]?.total || 0;
    } catch { return null; }
}

/** Tiga emoji weapon pertama untuk class hewan ini, lalu "+ N more". */
function weaponLine(animal) {
    const ids = weaponIdsFor(animal);
    const shown = ids.slice(0, 3).map((id) => WeaponInterface.weapons[id].getEmoji).join('');
    return ids.length > 3 ? `${shown} + ${ids.length - 3} more` : shown;
}

module.exports = {
    name: 'dex',
    aliases: ['od', 'owodex'],
    async execute(message, args) {
        const name = displayName(message);
        if (args.length !== 1) return err(message, name, 'the correct command is `sdex {animal}`!');
        const animal = findAnimal(args[0]);
        if (!animal) return err(message, name, 'I could not find that animal in your zoo!');
        const doc = await getAnimalDoc(message.author.id, animal.key);
        if (!doc) return err(message, name, 'I could not find that animal in your zoo!');

        if (onCooldown(message, 'owodex')) return;
        cooldown.start('owodex', message.author.id);

        const rank = RANKS[animal.rank];
        const total = await totalCaught(animal.key);
        const sell = doc.sellcount > 0 ? `${fmt(rank.price)} Cash | ${fmt(doc.sellcount)} sold` : '???';
        const sac = doc.saccount > 0 ? `${fmt(rank.essence)} Essence | ${fmt(doc.saccount)} killed` : '???';
        const alias = animal.alias.filter((a) => a !== animal.key).join(', ') || 'None';
        const lines = [
            `**${animal.uni} ${animal.name}**`,
            `*${animal.desc}*`,
            '',
            doc.nickname ? `**Nickname:** ${doc.nickname}` : null,
            `**Count:** ${doc.count}/${doc.totalcount}`,
            `**Rank:** ${rank.emoji} ${rank.id}`,
            total === null ? null : `**Rarity:** ${fmt(total)} total caught`,
            `**Alias:** ${alias}`,
            `**Points:** ${fmt(rank.points)}`,
            `**Sell:** ${sell}`,
            `**Sacrifice:** ${sac}`,
            '',
            `**Base stats (${animal.hpr + animal.attr + animal.prr + animal.wpr + animal.magr + animal.mrr} total)**`,
            `${WeaponInterface.hpEmoji} \`${animal.hpr}\` ${WeaponInterface.strEmoji} \`${animal.attr}\` ${WeaponInterface.prEmoji} \`${animal.prr}\``,
            `${WeaponInterface.wpEmoji} \`${animal.wpr}\` ${WeaponInterface.magEmoji} \`${animal.magr}\` ${WeaponInterface.mrEmoji} \`${animal.mrr}\``,
            '',
            `**Class:** ${classOf(animal)}: ${weaponLine(animal)}`
        ].filter((l) => l !== null);
        return send(message, lines.join('\n'));
    }
};
