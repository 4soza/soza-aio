// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0 (https://github.com/ChristopherBThai/Discord-OwO-Bot)
// Ring shop: data, inventory (FunRing) and atomic buy/sell. Cash via Economy (atomic).
const Ring = require('../../models/funeconomy/ring');
const Economy = require('../../models/funeconomy/economy');

const DUPLICATE_KEY = 11000;
const SELL_RATE = 0.75;

// Emoji Unicode bawaan; diganti emoji kustom (cring, uring, ...) oleh funeconomy/customEmoji.js saat bot siap.
const RINGS = {
    1: { id: 1, name: 'Common Ring', emoji: '⚪💍', rarity: 'common', price: 10 },
    2: { id: 2, name: 'Uncommon Ring', emoji: '🟢💍', rarity: 'uncommon', price: 100 },
    3: { id: 3, name: 'Rare Ring', emoji: '🔵💍', rarity: 'rare', price: 1000 },
    4: { id: 4, name: 'Epic Ring', emoji: '🟣💍', rarity: 'epic', price: 10000 },
    5: { id: 5, name: 'Mythical Ring', emoji: '🔴💍', rarity: 'mythical', price: 100000 },
    6: { id: 6, name: 'Legendary Ring', emoji: '🟠💍', rarity: 'legendary', price: 1000000 },
    7: { id: 7, name: 'Fabled Ring', emoji: '🟡💍', rarity: 'fabled', price: 10000000 }
};
const MAX_RING_ID = 7;

const getRing = (id) => RINGS[Number(id)] || null;
const sellPrice = (ring) => Math.round(ring.price * SELL_RATE);
const article = (word) => (/^[aeiou]/i.test(word) ? 'an' : 'a');

/** 1000 -> "1K", 10000000 -> "10M" (OwO toShortNum). */
function toShortNum(n) {
    if (n >= 1e9) return `${+(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `${+(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `${+(n / 1e3).toFixed(2)}K`;
    return String(n);
}

async function addRing(userId, rid, amount = 1) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            await Ring.updateOne({ userId, rid }, { $inc: { count: amount } }, { upsert: true });
            return;
        } catch (error) {
            if (error?.code !== DUPLICATE_KEY || attempt === 1) throw error;
        }
    }
}

/** Atomically take one ring. true when the user owned it. */
async function takeRing(userId, rid) {
    const updated = await Ring.findOneAndUpdate(
        { userId, rid, count: { $gte: 1 } }, { $inc: { count: -1 } }, { new: true }
    ).lean();
    return Boolean(updated);
}

async function getRingCount(userId, rid) {
    const doc = await Ring.findOne({ userId, rid }).lean();
    return doc?.count || 0;
}

/** Inventory entries: [{ id, emoji, count }] */
async function getItems(userId) {
    const docs = await Ring.find({ userId, count: { $gt: 0 } }).lean();
    return docs.filter((d) => RINGS[d.rid]).map((d) => ({ id: d.rid, emoji: RINGS[d.rid].emoji, count: d.count }));
}

/** Buy one ring with cash. Return { ring, price } or { error: 'missing'|'cash' }. */
async function buyRing(userId, id) {
    const ring = getRing(id);
    if (!ring) return { error: 'missing' };
    const paid = await Economy.deduct(userId, ring.price);
    if (!paid) return { error: 'cash' };
    try {
        await addRing(userId, ring.id);
    } catch (error) {
        await Economy.add(userId, ring.price).catch(() => {});
        throw error;
    }
    return { ring, price: ring.price };
}

/**
 * Sell one ring for 75% of its price (OwO `owo sell {id}` for ids <= 7). Exported so the sell command can call
 * `ringShop.sellRing(userId, id)`. Return { ring, price } or { error: 'missing'|'none' }.
 */
async function sellRing(userId, id) {
    const ring = getRing(id);
    if (!ring) return { error: 'missing' };
    if (!(await takeRing(userId, ring.id))) return { error: 'none' };
    const price = sellPrice(ring);
    try {
        await Economy.add(userId, price);
    } catch (error) {
        await addRing(userId, ring.id).catch(() => {});
        throw error;
    }
    return { ring, price };
}

module.exports = {
    RINGS, MAX_RING_ID, SELL_RATE, getRing, sellPrice, article, toShortNum,
    addRing, takeRing, getRingCount, getItems, buyRing, sellRing
};
