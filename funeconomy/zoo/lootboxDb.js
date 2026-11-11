// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
const Lootbox = require('../../models/funeconomy/lootbox');
const Gems = require('./gems');
const { LOOTBOX_CHANCE } = require('./hunting');
const { dayNumber } = require('./format');

const DUPLICATE_KEY = 11000;
const DAILY_LIMIT = 3;
const MAX_OPEN = 100;

async function ensure(userId) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            await Lootbox.updateOne({ userId }, { $setOnInsert: { boxcount: 0, claimcount: 0, claimDay: -1 } }, { upsert: true });
            return;
        } catch (error) {
            if (error?.code !== DUPLICATE_KEY || attempt === 1) throw error;
        }
    }
}

/**
 * Peluang lootbox saat hunt (aturan OwO): hunt pertama di hari baru selalu dapat lootbox,
 * sesudahnya 5% sampai maksimum 3 per hari. Atomik, tidak bisa lewat batas harian.
 * Return { claimed, count } (count = nomor lootbox hari ini).
 */
async function claimFromHunt(userId, { now = Date.now(), rng = Math.random } = {}) {
    const today = dayNumber(now);
    await ensure(userId);
    const first = await Lootbox.findOneAndUpdate(
        { userId, claimDay: { $lt: today } },
        { $inc: { boxcount: 1 }, $set: { claimcount: 1, claimDay: today } },
        { new: true }
    ).lean();
    if (first) return { claimed: true, count: 1 };
    if (rng() > LOOTBOX_CHANCE) return { claimed: false, count: 0 };
    const next = await Lootbox.findOneAndUpdate(
        { userId, claimDay: today, claimcount: { $lt: DAILY_LIMIT } },
        { $inc: { boxcount: 1, claimcount: 1 } },
        { new: true }
    ).lean();
    return next ? { claimed: true, count: next.claimcount } : { claimed: false, count: 0 };
}

async function getBoxCount(userId) {
    const doc = await Lootbox.findOne({ userId }).lean();
    return doc?.boxcount || 0;
}

/** Buka `count` lootbox. Return { gems: {key:{gem,count}} } atau null kalau lootbox tidak cukup. */
async function openBoxes(userId, count, rng = Math.random) {
    const taken = await Lootbox.findOneAndUpdate(
        { userId, boxcount: { $gte: count } },
        { $inc: { boxcount: -count } },
        { new: true }
    ).lean();
    if (!taken) return null;
    const gems = Gems.randomGems(count, rng);
    try {
        const counts = {};
        for (const [key, { count: n }] of Object.entries(gems)) counts[key] = n;
        await Gems.addGems(userId, counts);
    } catch (error) {
        await Lootbox.updateOne({ userId }, { $inc: { boxcount: count } }).catch(() => {});
        throw error;
    }
    return { gems };
}

module.exports = { DAILY_LIMIT, MAX_OPEN, claimFromHunt, getBoxCount, openBoxes };
