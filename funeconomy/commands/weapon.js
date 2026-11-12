// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0 (https://github.com/ChristopherBThai/Discord-OwO-Bot)
const emojis = require('../customEmoji');
const cfg = require('../config');
const { track } = require('../inactivity');
const weaponDb = require('../battle/weaponDb');
const teamUtil = require('../battle/teamUtil');
const challengeDb = require('../battle/challengeDb');
const weaponView = require('../battle/weaponView');
const { ANIMALS } = require('../zoo/data');
const Animal = require('../../models/funeconomy/animal');
const { canEmbed, send, onCooldown } = require('../utils');
const cooldown = require('../cooldown');
const { fail, reply, userName, animalFromToken, isInt, WEAPON_EMOJI } = require('../battle/commandUtil');

const BUSY = `You cannot change your weapon while you have a pending battle! Use \`${cfg.PREFIX}db\` to decline it!`;
const SORT_ALIASES = {
    id: 'id', rarity: 'rarity', quality: 'rarity', type: 'type', equipped: 'equipped', favorite: 'favorite', fav: 'favorite',
    tt: 'tt', kills: 'tt', wear: 'wear'
};

async function list(message, { sort = 'id', wid } = {}) {
    const msg = await weaponView.listMessage(message.author.id, userName(message.guild, message.author), { sort, wid });
    if (!msg) return fail(message, 'you do not have any weapons, or the page is out of bounds', 3000);
    return track(await message.channel.send({ ...msg, allowedMentions: { parse: [] } }));
}

async function describe(message, token, client) {
    const uwid = weaponDb.expandUWID(token);
    const doc = await weaponDb.getWeaponDoc(uwid);
    const weapon = weaponDb.parseWeapon(doc);
    if (!weapon) return fail(message, `I could not find a weapon with that unique weapon id! Please use \`${cfg.PREFIX}weapon\` for the weapon ID!`);
    const owner = doc.userId === message.author.id ? message.author : await client.users.fetch(doc.userId).catch(() => null);
    const ownerName = owner ? userName(message.guild, owner) : 'A User';
    if (!canEmbed(message)) return send(message, `**${weapon.fullName}** ${weapon.avgQuality}%`);
    return message.channel.send({ embeds: [weaponView.detailEmbed(weapon, ownerName, doc.animal)], allowedMentions: { parse: [] } });
}

async function equip(message, uwidToken, petToken) {
    const userId = message.author.id;
    const uwid = weaponDb.expandUWID(uwidToken);
    let key;
    if (isInt(petToken)) {
        const pos = parseInt(petToken, 10);
        if (pos < 1 || pos > 3) return fail(message, `Invalid arguments! Use \`${cfg.PREFIX}weapon {uniqueWeaponId} {animalPos|animal}\``);
        const active = await teamUtil.getActiveTeam(userId);
        key = active?.team.slots[pos - 1];
    } else {
        key = animalFromToken(petToken)?.key;
    }
    const usage = `could not find that weapon or animal! The correct command is \`${cfg.PREFIX}weapon {weaponID} {animal}\`\n▫️ **|** The weaponID can be found in the command \`${cfg.PREFIX}weapon\``;
    if (!uwid || !key || !(await teamUtil.ownsAnimal(userId, key))) return fail(message, usage);
    const doc = await weaponDb.equip(userId, uwid, key);
    if (!doc) return fail(message, usage);
    const weapon = weaponDb.parseWeapon(doc);
    const animalDoc = await Animal.findOne({ userId, name: key }).lean();
    return reply(message, WEAPON_EMOJI, `${ANIMALS[key].uni} **${animalDoc?.nickname || ANIMALS[key].name}** is now wielding ${weapon.emoji} **${weapon.name}**!`);
}

async function unequip(message, token) {
    const uwid = weaponDb.expandUWID(token);
    if (!uwid) return fail(message, 'Could not find a weapon with that id!');
    const prev = await weaponDb.unequip(message.author.id, uwid);
    if (!prev) {
        const exists = await weaponDb.getWeaponDoc(uwid, message.author.id);
        return fail(message, exists ? 'this weapon is not equipped on anyone!' : 'Could not find a weapon with that id!');
    }
    const weapon = weaponDb.parseWeapon(prev);
    return reply(message, WEAPON_EMOJI, `Unequipped ${weapon.emoji} **${weapon.name}** from ${ANIMALS[prev.animal]?.uni || ''}`);
}

async function favorite(message, token, value) {
    const uwid = weaponDb.expandUWID(token);
    const doc = uwid && await weaponDb.setFavorite(message.author.id, uwid, value);
    if (!doc) return fail(message, 'Could not find a weapon with that id!');
    return reply(message, '⭐', `${value ? 'favorited' : 'unfavorited'} \`${weaponDb.shortenUWID(uwid)}\`!`);
}

async function reroll(message, args) {
    const isP = (t) => ['passive', 'p'].includes((t || '').toLowerCase());
    const isS = (t) => ['stat', 'stats', 's'].includes((t || '').toLowerCase());
    let type;
    let token;
    if (isP(args[1])) { type = 'p'; token = args[2]; }
    else if (isP(args[2])) { type = 'p'; token = args[1]; }
    else if (isS(args[1])) { type = 's'; token = args[2]; }
    else if (isS(args[2])) { type = 's'; token = args[1]; }
    const uwid = weaponDb.expandUWID(token);
    if (!type || !uwid) return fail(message, `invalid syntax! Please use the format: \`${cfg.PREFIX}w rr {weaponID} [passive|stat]\`!`, 5000);

    const result = await weaponDb.startReroll(message.author.id, uwid, type);
    if (result.error === 'missing') return fail(message, `I could not find a weapon with that unique weapon id! Please use \`${cfg.PREFIX}weapon\` for the weapon ID!`, 4000);
    if (result.error === 'disabled') return fail(message, "I can't reroll this weapon!", 4000);
    if (result.error === 'shards') return fail(message, `you need ${weaponDb.REROLL_PRICE} ${emojis.shard()} Weapon Shards to reroll a weapon!`, 4000);
    return track(await message.channel.send({
        ...weaponView.rerollMessage(message.author.id, userName(message.guild, message.author), result.weapon, result.next),
        allowedMentions: { parse: [] }
    }));
}

// sweapon [sort] [101+ filter] | <id> | <id> <animal|pos> | unequip <id> | rr <id> passive|stat | fav <id>
module.exports = {
    name: 'weapon',
    aliases: ['w', 'weapons', 'wep'],
    async execute(message, args, client) {
        if (onCooldown(message, 'weapon')) return;
        const sub = (args[0] || '').toLowerCase();
        const guardBusy = async () => challengeDb.inBattle(message.author.id);
        cooldown.start('weapon', message.author.id);

        if (!args.length) return list(message);
        if (['rr', 'reroll'].includes(sub)) return reroll(message, args);
        if (['fav', 'favorite', 'unfav', 'unfavorite'].includes(sub) && args[1]) {
            return favorite(message, args[1], !sub.startsWith('un'));
        }
        if (['unequip', 'ue'].includes(sub) && args.length === 2) {
            if (await guardBusy()) return fail(message, BUSY, 3000);
            return unequip(message, args[1]);
        }
        if (args.length === 1) {
            if (SORT_ALIASES[sub]) return list(message, { sort: SORT_ALIASES[sub] });
            if (isInt(args[0]) && weaponDb.rankFromAlias(args[0]) < 0 && require('../battle/WeaponInterface').weapons[parseInt(args[0], 10) - 100]) {
                return list(message, { wid: parseInt(args[0], 10) - 100 });
            }
            return describe(message, args[0], client);
        }
        if (args.length === 2) {
            if (await guardBusy()) return fail(message, BUSY, 3000);
            return equip(message, args[0], args[1]);
        }
        return fail(message, 'Invalid arguments', 3000);
    }
};
