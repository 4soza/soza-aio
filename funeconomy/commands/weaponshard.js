// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0 (https://github.com/ChristopherBThai/Discord-OwO-Bot)
const emojis = require('../customEmoji');
const cfg = require('../config');
const weaponDb = require('../battle/weaponDb');
const crateDb = require('../battle/crateDb');
const { fmt, onCooldown } = require('../utils');
const cooldown = require('../cooldown');
const { fail, reply, DISMANTLE_EMOJI } = require('../battle/commandUtil');

async function dismantleRank(message, rankIndex) {
    const userId = message.author.id;
    const result = await weaponDb.removeRank(userId, rankIndex);
    if (!result.weapons.length) return fail(message, 'you do not have any weapons with this rank!', 3000);
    const price = weaponDb.SHARD_PRICES[result.rank] * result.deleted;
    await crateDb.addShards(userId, price);
    const rankEmoji = result.weapons[0].rank.emoji;
    return reply(message, DISMANTLE_EMOJI,
        `You dismantled all of your ${rankEmoji} **${result.rank}** weapons for **${fmt(price)}** ${emojis.shard()} WeaponShards!\n▫️ **| Dismantled:** ${result.weapons.map((w) => w.emoji).join('')}`);
}

async function dismantleId(message, token) {
    const userId = message.author.id;
    const uwid = weaponDb.expandUWID(token);
    if (!uwid) return fail(message, 'you do not have a weapon with this id!', 3000);
    const result = await weaponDb.removeWeapon(userId, uwid);
    if (result.error === 'equipped') return fail(message, 'please unequip the weapon to dismantle it!', 3000);
    if (result.error === 'unsellable') return fail(message, 'This weapon cannot be dismantled!');
    if (result.error === 'favorite') return fail(message, 'unfavorite this weapon to dismantle!');
    if (result.error) return fail(message, 'you do not have a weapon with this id!', 3000);
    const weapon = result.weapon;
    const price = weaponDb.SHARD_PRICES[weapon.rank.name];
    await crateDb.addShards(userId, price);
    return reply(message, DISMANTLE_EMOJI,
        `You dismantled a(n) **${weapon.rank.name} ${weapon.name}** ${weapon.rank.emoji}${weapon.emoji} for **${fmt(price)}** ${emojis.shard()} Weapon Shard${price === 1 ? '' : 's'}!`);
}

// sws = lihat shard | sws <id|cw|uw|rw|ew|mw|lw|fw> = bongkar senjata jadi shard
module.exports = {
    name: 'weaponshard',
    aliases: ['ws', 'weaponshards', 'dismantle'],
    async execute(message, args) {
        if (onCooldown(message, 'weapon')) return;
        const userId = message.author.id;
        if (!args.length) {
            cooldown.start('weapon', userId);
            const shards = await crateDb.getShards(userId);
            return reply(message, emojis.shard(), `you currently have **${fmt(shards)}** Weapon Shards! Reroll weapons with \`${cfg.PREFIX}w rr {weaponID} [passive|stat]\`.`);
        }
        const token = args[0].toLowerCase();
        cooldown.start('weapon', userId);
        const rank = weaponDb.rankFromAlias(token);
        if (rank >= 0) return dismantleRank(message, rank);
        return dismantleId(message, token);
    }
};
