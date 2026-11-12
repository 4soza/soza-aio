// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0 (https://github.com/ChristopherBThai/Discord-OwO-Bot)
// Thin dispatcher: use inventory items by id through the existing gem / lootbox / crate commands.
const cfg = require('../config');
const { sendTemporaryError, displayName } = require('../utils');
const gem = require('./gem');
const lootbox = require('./lootbox');
const crate = require('./crate');

const err = (message, text) => sendTemporaryError(message, `**🚫 | ${displayName(message)}**, ${text}`, 3000);

const kindOf = (id) => {
    if (id >= 1 && id <= 7) return 'ring';
    if (id === 50) return 'lootbox';
    if (id > 50 && id < 100) return 'gem';
    if (id === 100) return 'crate';
    if (id > 100) return 'weapon';
    return null;
};

module.exports = {
    name: 'equip',
    aliases: [],
    async execute(message, args, client) {
        if (!args.length) return err(message, 'please provide an id of an item to use!');
        if (!args.every((a) => /^\d+$/.test(a))) {
            return err(message, `use the weapon command to equip weapons: \`${cfg.PREFIX}weapon {weaponID} {animal}\``);
        }
        const ids = args.map(Number);
        const kinds = ids.map(kindOf);
        const missing = ids.findIndex((_, i) => !kinds[i]);
        if (missing >= 0) return err(message, `I could not find item ${args[missing]}`);
        if (ids.length > 1 && kinds.some((k) => k !== 'gem')) return err(message, 'you can only use multiple gems at one time!');

        switch (kinds[0]) {
        case 'gem': return gem.execute(message, args, client);
        case 'lootbox': return lootbox.execute(message, [], client);
        case 'crate': return crate.execute(message, [], client);
        case 'ring': return err(message, `use the marry command to use rings: \`${cfg.PREFIX}marry @user ${ids[0]}\``);
        default: return err(message, `use the weapon command to see or equip your weapons: \`${cfg.PREFIX}weapon ${ids[0]}\``);
        }
    }
};
