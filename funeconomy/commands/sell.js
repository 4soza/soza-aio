// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
const cfg = require('../config');
const Economy = require('../../models/funeconomy/economy');
const cooldown = require('../cooldown');
const { fmt, displayName, send, sendTemporaryError, onCooldown } = require('../utils');
const { RANKS } = require('../zoo/data');
const { takeForExchange, takeRanks } = require('../zoo/zooDb');
const { parseExchangeArgs, rankSummary } = require('../zoo/args');
const ringShop = require('../shop/ringShop');
const weaponDb = require('../battle/weaponDb');
const weaponView = require('../battle/weaponView');
const { track } = require('../inactivity');

// Rank senjata untuk jual: cw uw rw ew mw lw fw (atau "uncommonweapons"). Kata "common"/"rare" sendiri tetap jual hewan.
function weaponRank(token) {
    const t = String(token || '').toLowerCase();
    if (!/^[curemlf]w$/.test(t) && !/weapons?$/.test(t)) return -1;
    return weaponDb.rankFromAlias(t);
}

const err = (message, name, text) => sendTemporaryError(message, `**🚫 | ${name}**, ${text}`);

/** Jual dan kembalikan teks hasil, atau { error }. Dipisah dari command supaya bisa diuji. */
async function sellAnimal(userId, animal, count) {
    const sold = await takeForExchange(userId, animal.key, count, 'sellcount');
    if (!sold) return { error: 'notenough' };
    const total = sold * RANKS[animal.rank].price;
    await Economy.add(userId, total);
    return { sold, total };
}

async function sellRanks(userId, rankIds) {
    const taken = await takeRanks(userId, rankIds, 'sellcount');
    let total = 0;
    for (const [rank, n] of Object.entries(taken)) total += n * RANKS[rank].price;
    if (!total) return { error: 'notenough' };
    await Economy.add(userId, total);
    return { taken, total };
}

module.exports = {
    name: 'sell',
    aliases: [],
    async execute(message, args) {
        const userId = message.author.id;
        const name = displayName(message);

        // `ssell 1` sampai `ssell 7` menjual ring (75% dari harga), seperti OwO.
        if (args.length === 1 && /^[1-7]$/.test(args[0])) {
            if (onCooldown(message, 'sell')) return;
            cooldown.start('sell', userId);
            const sold = await ringShop.sellRing(userId, args[0]);
            if (sold.error) return err(message, name, "You don't have that ring!");
            return send(message, `**💰 | ${name}** sold ${ringShop.article(sold.ring.name)} **${sold.ring.name}** ${sold.ring.emoji} for **${cfg.CASH_EMOJI} ${fmt(sold.price)}**`);
        }

        // `ssell uw` = jual semua senjata uncommon (ada konfirmasi), `ssell {weaponID}` = jual satu senjata.
        const wRank = args.length === 1 ? weaponRank(args[0]) : -1;
        if (wRank >= 0) {
            if (onCooldown(message, 'sell')) return;
            cooldown.start('sell', userId);
            const weapons = await weaponDb.findRankWeapons(userId, wRank);
            if (!weapons.length) return err(message, name, 'You do not have any weapons of that rank to sell!');
            return track(await message.channel.send({
                ...weaponView.sellMessage(userId, wRank, weapons), allowedMentions: { parse: [] }
            }));
        }

        const parsed = parseExchangeArgs(args);
        if (parsed.error === 'notfound' && args.length === 1 && weaponDb.expandUWID(args[0])) {
            if (onCooldown(message, 'sell')) return;
            cooldown.start('sell', userId);
            const result = await weaponDb.removeWeapon(userId, weaponDb.expandUWID(args[0]));
            if (result.error === 'equipped') return err(message, name, 'please unequip the weapon to sell it!');
            if (result.error === 'unsellable') return err(message, name, 'This weapon cannot be sold!');
            if (result.error === 'favorite') return err(message, name, 'unfavorite this weapon to sell it!');
            if (result.error) return err(message, name, 'I could not find that animal, rank or weapon!');
            const price = weaponDb.SELL_PRICES[result.weapon.rank.name];
            await Economy.add(userId, price);
            return send(message, `**🔪 | ${name}** sold ${result.weapon.rank.emoji}${result.weapon.emoji} **${result.weapon.name}** for **${cfg.CASH_EMOJI} ${fmt(price)}**`);
        }

        if (parsed.error === 'none') return err(message, name, 'Please specify what rank/animal to sell!');
        if (parsed.error === 'invalid') return err(message, name, 'Invalid arguments!');
        if (parsed.error === 'syntax-animal') return err(message, name, `The correct syntax for selling animals is \`${cfg.PREFIX}sell {animal} {count}\`!`);
        if (parsed.error === 'syntax-rank') return err(message, name, `The correct syntax for selling ranks is \`${cfg.PREFIX}sell {rank}\`!`);
        if (parsed.error === 'notfound') return err(message, name, 'I could not find that animal or rank!');
        if (parsed.animal && parsed.count !== 'all' && parsed.count <= 0) return err(message, name, 'You need to sell more than 1 silly~');

        if (onCooldown(message, 'sell')) return;
        cooldown.start('sell', userId);

        if (parsed.ranks) {
            const result = await sellRanks(userId, parsed.ranks);
            if (result.error) return err(message, name, "You don't have enough animals! >:c");
            return send(message, `**🔪 | ${name}** sold **${rankSummary(result.taken)}** for a total of **${cfg.CASH_EMOJI} ${fmt(result.total)}**`);
        }
        const result = await sellAnimal(userId, parsed.animal, parsed.count);
        if (result.error) {
            return err(message, name, parsed.count === 'all'
                ? "You don't have enough animals! >:c"
                : "You can't sell more than you have silly! >:c");
        }
        return send(message, `**🔪 | ${name}** sold **${parsed.animal.uni}x${result.sold}** for a total of **${cfg.CASH_EMOJI} ${fmt(result.total)}**`);
    },
    _internals: { sellAnimal, sellRanks }
};
