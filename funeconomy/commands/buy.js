// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0 (https://github.com/ChristopherBThai/Discord-OwO-Bot)
const emojis = require('../customEmoji');
const cfg = require('../config');
const cooldown = require('../cooldown');
const { fmt, send, onCooldown } = require('../utils');
const { fail } = require('../battle/commandUtil');
const ringShop = require('../shop/ringShop');
const weaponShop = require('../shop/weaponShop');
const { weaponIcons } = require('../battle/weaponView');
const { displayName } = require('../utils');

const CART = '🛒';
const NOT_FOUND = `that item does not exist! Please choose one from \`${cfg.PREFIX}shop\`!`;

async function buyRing(message, id) {
    const result = await ringShop.buyRing(message.author.id, id);
    if (result.error === 'missing') return fail(message, NOT_FOUND, 3000);
    if (result.error === 'cash') return fail(message, 'you do not have enough cash! >:c', 3000);
    const { ring, price } = result;
    return send(message, `${CART} **| ${displayName(message)}**, you bought ${ringShop.article(ring.name)} ${ring.emoji} **${ring.name}** for **${fmt(price)}** ${cfg.CASH_EMOJI}!`);
}

async function buyWeaponShop(message, id) {
    const result = await weaponShop.buy(message.author.id, id);
    if (result.error === 'shards') return fail(message, "You don't have enough Weapon Shards!", 3000);
    if (result.error === 'purchased') return fail(message, 'You already purchased this weapon, silly!', 3000);
    if (result.error === 'missing') return fail(message, 'what are you trying to buy...?', 3000);
    const name = displayName(message);
    if (result.crate) {
        return send(message, `${CART} **| ${name}**, you purchased a **${emojis.crate()} Weapon Crate** for **${result.price} ${emojis.shard()} Weapon Shards**`);
    }
    const w = result.weapon;
    return send(message, `${CART} **| ${name}**, you purchased **${result.shopId}** \`${w.uwid}\` ${weaponIcons(w)} for **${result.price} ${emojis.shard()} Weapon Shards**!`);
}

// sbuy <id>: 1-7 rings (cash), 100 crate / 101+ daily weapons (weapon shards)
module.exports = {
    name: 'buy',
    aliases: [],
    async execute(message, args) {
        if (!/^\d+$/.test(args[0] || '')) return fail(message, 'invalid arguments! Please specify what item you want to buy!', 3000);
        const id = parseInt(args[0], 10);
        if (id <= 0) return fail(message, NOT_FOUND, 3000);
        const isRing = id <= ringShop.MAX_RING_ID;
        const isShop = id >= weaponShop.CRATE_ID && id <= 150;
        if (!isRing && !isShop) return fail(message, NOT_FOUND, 3000);
        if (onCooldown(message, 'buy')) return;
        cooldown.start('buy', message.author.id);
        return isRing ? buyRing(message, id) : buyWeaponShop(message, id);
    }
};
