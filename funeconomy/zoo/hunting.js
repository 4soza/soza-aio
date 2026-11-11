// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
const { RANKS, RANK_ORDER, ANIMALS_BY_RANK, ANIMALS } = require('./data');

const HUNT_COST = 5;
const LOOTBOX_CHANCE = 0.05;

/**
 * Peluang (persen) tiap rank. Rank conditional (gem, bot) hanya aktif lewat opts:
 *   opts.gem = true (ada gem aktif), opts.lucky = { amount }, opts.huntbot = persen rank bot.
 */
function getRarities(opts = {}) {
    const rarity = {};
    for (const id of RANK_ORDER) rarity[id] = RANKS[id].conditional ? 0 : RANKS[id].rarity;
    if (opts.gem) {
        let gemRarity = RANKS.gem.rarity;
        if (opts.lucky) gemRarity *= opts.lucky.amount;
        rarity.gem = gemRarity;
        rarity.common -= gemRarity;
    }
    if (opts.huntbot) {
        rarity.bot = opts.huntbot;
        rarity.common -= opts.huntbot;
    }
    return rarity;
}

/** Pilih rank dari peluang. rand di [0,1). */
function pickRank(rarities, rand = Math.random()) {
    const entries = Object.entries(rarities);
    const totalRarity = entries.reduce((sum, [, v]) => sum + v, 0);
    const target = rand * totalRarity;
    let total = 0;
    let last = 'common';
    for (const [rank, v] of entries) {
        if (v <= 0) continue;
        total += v;
        last = rank;
        if (target < total) return rank;
    }
    return last;
}

function randomAnimal(opts = {}, rng = Math.random) {
    const rank = pickRank(getRarities(opts), rng());
    const list = ANIMALS_BY_RANK[rank];
    return ANIMALS[list[Math.floor(rng() * list.length)]];
}

/** Tangkap `count` hewan. Return { ordered: [{key,uni,rank,count,...}], xp, total }. */
function huntMany(count, opts = {}, rng = Math.random) {
    const total = {};
    let xp = 0;
    for (let i = 0; i < count; i += 1) {
        const animal = randomAnimal(opts, rng);
        const rank = RANKS[animal.rank];
        xp += rank.xp;
        if (total[animal.key]) total[animal.key].count += 1;
        else total[animal.key] = { key: animal.key, uni: animal.uni, rank: rank.id, count: 1, order: rank.order };
    }
    const ordered = Object.values(total).sort((a, b) => a.order - b.order || (a.key < b.key ? -1 : 1));
    return { ordered, xp, total };
}

module.exports = { HUNT_COST, LOOTBOX_CHANCE, getRarities, pickRank, randomAnimal, huntMany };
