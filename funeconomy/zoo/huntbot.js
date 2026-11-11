// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
const Autohunt = require('../../models/funeconomy/autohunt');

const DUPLICATE_KEY = 11000;
const TRAITS = {
    efficiency: { inc: 10, pow: 1.748, base: 25, upg: 1, max: 215, prefix: '/H' },
    duration: { inc: 10, pow: 1.7, base: 0.5, upg: 0.1, max: 235, prefix: 'H' },
    cost: { inc: 1000, pow: 3.4, base: 10, upg: -1, max: 5, prefix: ' cash' },
    gain: { inc: 10, pow: 1.8, base: 0, upg: 25, max: 200, prefix: ' essence/H' },
    exp: { inc: 10, pow: 1.8, base: 0, upg: 35, max: 200, prefix: ' xp/H' },
    radar: { inc: 50, pow: 2.5, base: 0, upg: 0.00000004, max: 999, prefix: ' %' }
};
const TRAIT_NAMES = Object.keys(TRAITS);
const TRAIT_ALIASES = {};
for (const [trait, words] of Object.entries({
    efficiency: ['efficiency', 'timer', 'cd', 'cooldown'],
    cost: ['cost', 'price', 'cash'],
    duration: ['duration', 'totaltime', 'time'],
    gain: ['gain', 'essence', 'ess'],
    exp: ['exp', 'experience', 'pet', 'xp'],
    radar: ['radar']
})) for (const w of words) TRAIT_ALIASES[w] = trait;

/** Level, stat, dan progres sebuah trait dari XP-nya (+ `gain` XP tambahan). Port dari OwO. */
function getLvl(xp, gain, traitName) {
    const trait = TRAITS[traitName];
    let totalxp = 0;
    let hit = false;
    let prevlvl = 0;
    for (let i = 1; i <= trait.max + 1; i += 1) {
        const lvlxp = Math.trunc(trait.inc * Math.pow(i, trait.pow));
        totalxp += lvlxp;
        if (!hit && totalxp > xp) { prevlvl = i - 1; hit = true; }
        if ((hit || i === trait.max + 1) && (totalxp > xp + gain || i === trait.max + 1)) {
            const temp = { lvl: i - 1 };
            if (temp.lvl === trait.max) temp.max = true;
            temp.currentxp = xp + gain - (totalxp - lvlxp);
            temp.maxxp = lvlxp;
            if (prevlvl < temp.lvl) temp.lvlup = true;
            let stat = trait.base + trait.upg * temp.lvl;
            stat = traitName === 'radar' ? Math.round(stat * 10000000) / 100000 : Math.trunc(stat * 10) / 10;
            temp.stat = stat;
            temp.prefix = trait.prefix;
            return temp;
        }
    }
    return null;
}

/** Semua trait dari dokumen (atau default level 0). */
function readTraits(doc) {
    const out = {};
    for (const name of TRAIT_NAMES) out[name] = getLvl(doc?.[name] || 0, 0, name);
    return out;
}

async function ensure(userId) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            await Autohunt.updateOne({ userId }, { $setOnInsert: { essence: 0 } }, { upsert: true });
            return;
        } catch (error) {
            if (error?.code !== DUPLICATE_KEY || attempt === 1) throw error;
        }
    }
}

const get = (userId) => Autohunt.findOne({ userId }).lean();

async function addEssence(userId, amount) {
    if (!(amount > 0)) return;
    await ensure(userId);
    await Autohunt.updateOne({ userId }, { $inc: { essence: amount, total: amount } });
}

/**
 * Upgrade trait memakai essence (atomik, optimistic). mode: { count } | { all: true } | { level: true }.
 * Return { error } atau { spent, stat }.
 */
async function upgrade(userId, trait, mode) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const doc = await get(userId);
        if (!doc || doc.essence <= 0) return { error: 'essence' };
        const oldXp = doc[trait] || 0;
        const before = getLvl(oldXp, 0, trait);
        if (before.max) return { error: 'max' };
        let count = mode.level ? before.maxxp - before.currentxp : mode.all ? doc.essence : mode.count;
        if (!(count > 0) || doc.essence < count) return { error: 'essence' };
        let stat = getLvl(oldXp, count, trait);
        if (stat.max) count -= stat.currentxp; // kembalikan kelebihan
        stat = getLvl(oldXp, count, trait);
        const updated = await Autohunt.findOneAndUpdate(
            { userId, essence: { $gte: count }, [trait]: oldXp },
            { $inc: { essence: -count, [trait]: count } },
            { new: true }
        ).lean();
        if (updated) return { spent: count, stat };
    }
    return { error: 'busy' };
}

/** Mulai hunt bot secara atomik. false kalau sedang berburu. */
async function start(userId, huntcount, huntmin, now = Date.now()) {
    await ensure(userId);
    const doc = await Autohunt.findOneAndUpdate(
        { userId, huntmin: { $not: { $gt: 0 } } },
        { $set: { huntcount, huntmin, startAt: now } },
        { new: true }
    ).lean();
    return Boolean(doc);
}

/**
 * Cek hunt bot. Return null kalau tidak berburu, { progress } kalau belum selesai,
 * atau { claimed } (hasil sudah dicatat atomik, essence sudah ditambah) kalau selesai.
 */
async function claim(userId, now = Date.now()) {
    const doc = await get(userId);
    if (!doc || !(doc.huntmin > 0)) return null;
    const timer = Math.floor((now - doc.startAt) / 60000);
    if (timer < doc.huntmin) {
        const left = doc.huntmin - timer;
        return { progress: { huntmin: doc.huntmin, timer, left, count: Math.trunc(doc.huntcount * (timer / doc.huntmin)) } };
    }
    const duration = doc.huntmin / 60;
    const t = readTraits(doc);
    const totalGain = Math.floor(t.gain.stat * duration);
    const totalExp = Math.floor(t.exp.stat * duration);
    const updated = await Autohunt.findOneAndUpdate(
        { userId, huntmin: doc.huntmin, startAt: doc.startAt },
        { $set: { huntmin: 0, huntcount: 0 }, $inc: { essence: totalGain, total: totalGain } },
        { new: true }
    ).lean();
    if (!updated) return null;
    return { claimed: { huntcount: doc.huntcount, totalGain, totalExp, radar: t.radar.stat } };
}

module.exports = { TRAITS, TRAIT_NAMES, TRAIT_ALIASES, getLvl, readTraits, get, addEssence, upgrade, start, claim };
