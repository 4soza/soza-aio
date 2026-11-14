// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
// Gem Hunting / Empowering / Lucky (Patreon dan Special tidak dipakai).
const Gem = require('../../models/funeconomy/gem');
const { RANKS } = require('./data');

const DUPLICATE_KEY = 11000;
const LETTER_RANK = { c: 'common', u: 'uncommon', r: 'rare', e: 'epic', m: 'mythical', l: 'legendary', f: 'fabled' };
const CHANCE = [0.22, 0.22, 0.2, 0.2, 0.1, 0.05, 0.01];
const LETTERS = ['c', 'u', 'r', 'e', 'm', 'l', 'f'];

const TYPES = {
    Hunting:    { icon: '🏹', suffix: 1, firstId: 51, lengths: [25, 25, 50, 75, 75, 100, 100], amounts: [1, 3, 4, 5, 6, 7, 9] },
    Empowering: { icon: '⚡', suffix: 3, firstId: 65, lengths: [50, 100, 250, 450, 525, 800, 1000] },
    Lucky:      { icon: '🍀', suffix: 4, firstId: 72, lengths: [50, 100, 250, 450, 525, 800, 1000], amounts: [1, 2, 3, 4, 5, 6, 7] }
};
const TYPE_ORDER = Object.keys(TYPES);

const GEMS = {};
const GEMS_BY_TYPE = {};
const GEMS_BY_ID = {};
for (const [type, def] of Object.entries(TYPES)) {
    GEMS_BY_TYPE[type] = [];
    LETTERS.forEach((letter, i) => {
        const key = `${letter}gem${def.suffix}`;
        const rankId = LETTER_RANK[letter];
        const gem = {
            key, type, id: def.firstId + i, chance: CHANCE[i], length: def.lengths[i],
            amount: def.amounts?.[i], rank: rankId,
            rankName: rankId[0].toUpperCase() + rankId.slice(1),
            icon: def.icon, emoji: `${def.icon}${RANKS[rankId].emoji}`
        };
        GEMS[key] = gem;
        GEMS_BY_TYPE[type].push(gem);
        GEMS_BY_ID[gem.id] = gem;
    });
}

const getGemById = (id) => GEMS_BY_ID[Number(id)] || null;

/** Gem acak dari lootbox: tipe acak (rata), tingkat sesuai chance. */
function randomGem(rng = Math.random) {
    const type = TYPE_ORDER[Math.trunc(rng() * TYPE_ORDER.length)];
    const list = GEMS_BY_TYPE[type];
    const rand = rng();
    let sum = 0;
    for (const gem of list) {
        sum += gem.chance;
        if (rand < sum) return gem;
    }
    return list[0];
}

/** Gem acak sebanyak `count`. Return { key: { gem, count } }. */
/** Gem fabled acak (untuk fabled lootbox): tipe acak (rata). */
function randomFabledGem(rng = Math.random) {
    const type = TYPE_ORDER[Math.trunc(rng() * TYPE_ORDER.length)];
    return GEMS_BY_TYPE[type][LETTERS.indexOf('f')];
}

/** Sama seperti randomGems, randomFabledGems, tapi semuanya gem fabled. */
function randomFabledGems(count, rng = Math.random) {
    const out = {};
    for (let i = 0; i < count; i += 1) {
        const gem = randomFabledGem(rng);
        if (out[gem.key]) out[gem.key].count += 1;
        else out[gem.key] = { gem, count: 1 };
    }
    return out;
}

function randomGems(count, rng = Math.random) {
    const out = {};
    for (let i = 0; i < count; i += 1) {
        const gem = randomGem(rng);
        if (out[gem.key]) out[gem.key].count += 1;
        else out[gem.key] = { gem, count: 1 };
    }
    return out;
}

async function addGems(userId, counts) {
    const inc = {};
    for (const [key, n] of Object.entries(counts)) if (GEMS[key] && n > 0) inc[`gems.${key}`] = n;
    if (!Object.keys(inc).length) return;
    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            await Gem.updateOne({ userId }, { $inc: inc }, { upsert: true });
            return;
        } catch (error) {
            if (error?.code !== DUPLICATE_KEY || attempt === 1) throw error;
        }
    }
}

/** Return { gems: { key: n }, active: { Type: { key, left } } }. */
async function getInventory(userId) {
    const doc = await Gem.findOne({ userId }).lean();
    return { gems: doc?.gems || {}, active: doc?.active || {} };
}

/** Gem yang sedang aktif (left > 0): { Type: { gem, left } }. */
function activeOf(inventory) {
    const out = {};
    for (const type of TYPE_ORDER) {
        const slot = inventory.active?.[type];
        const gem = slot && GEMS[slot.key];
        if (gem && slot.left > 0) out[type] = { gem, left: slot.left };
    }
    return out;
}

async function getActiveGems(userId) {
    return activeOf(await getInventory(userId));
}

/** Aktifkan satu gem secara atomik. false kalau tidak punya atau tipe itu masih aktif. */
async function activate(userId, gem) {
    const updated = await Gem.findOneAndUpdate(
        { userId, [`gems.${gem.key}`]: { $gte: 1 }, [`active.${gem.type}.left`]: { $not: { $gt: 0 } } },
        { $inc: { [`gems.${gem.key}`]: -1 }, $set: { [`active.${gem.type}`]: { key: gem.key, left: gem.length } } },
        { new: true }
    ).lean();
    return Boolean(updated);
}

/** Jumlah pemakaian tiap gem aktif untuk satu hunt yang menangkap `count` hewan. */
function huntUsage(active, count) {
    const both = Boolean(active.Hunting && active.Empowering);
    const usage = {};
    if (active.Hunting) usage.Hunting = 1;
    if (active.Empowering) usage.Empowering = Math.trunc(count / 2);
    if (active.Lucky) usage.Lucky = both ? Math.trunc(count / 2) : count;
    return usage;
}

/** Sisa gem aktif sesudah satu hunt (dihitung lokal, tanpa database). */
function remainingAfterHunt(active, count) {
    const remaining = {};
    for (const [type, n] of Object.entries(huntUsage(active, count))) {
        const { gem, left } = active[type];
        remaining[type] = { gem, left: left - Math.min(n, left) };
    }
    return remaining;
}

/** Kurangi sisa gem aktif (tidak pernah di bawah sisa yang dibaca). Return sisa tiap tipe. */
async function consumeHunt(userId, active, count) {
    const remaining = remainingAfterHunt(active, count);
    await Promise.all(Object.entries(huntUsage(active, count)).map(([type, n]) => {
        const { gem, left } = active[type];
        const take = Math.min(n, left);
        return take > 0
            ? Gem.updateOne({ userId, [`active.${type}.key`]: gem.key }, { $inc: { [`active.${type}.left`]: -take } })
            : null;
    }));
    return remaining;
}

/** Hunt: jumlah hewan dan opsi rank dari gem aktif. */
function huntEffects(active) {
    let count = 1;
    const opts = {};
    if (Object.keys(active).length) {
        opts.gem = true;
        opts.lucky = active.Lucky ? { amount: active.Lucky.gem.amount } : undefined;
        if (active.Hunting) count += active.Hunting.gem.amount;
        if (active.Empowering) count *= 2;
    }
    return { count, opts };
}

function describeUse(gem) {
    const head = `Your next ${gem.length} `;
    if (gem.type === 'Hunting') return `${head}manual hunts will be increased by ${gem.amount}`;
    if (gem.type === 'Empowering') return `${head}animals will be doubled! It can stack with Hunting gems!`;
    return `${head}animals will have a +${gem.amount}x higher chance of finding gem tiers!`;
}

module.exports = {
    TYPES, TYPE_ORDER, GEMS, GEMS_BY_TYPE, getGemById, randomGem, randomGems, randomFabledGem, randomFabledGems, addGems, getInventory,
    activeOf, getActiveGems, activate, huntUsage, remainingAfterHunt, consumeHunt, huntEffects, describeUse
};
