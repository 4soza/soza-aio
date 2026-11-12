// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0 (https://github.com/ChristopherBThai/Discord-OwO-Bot)
// Daily weapon shop (OwO dailyWeaponUtil). The offers are generated from a seeded RNG keyed by the day number
// (same reset as the crate daily), so every user sees the same list and it survives restarts.
const WeaponInterface = require('../battle/WeaponInterface');
const weaponDb = require('../battle/weaponDb');
const crateDb = require('../battle/crateDb');
const ShopPurchase = require('../../models/funeconomy/shopPurchase');

const DUPLICATE_KEY = 11000;
const CRATE_ID = 100;
const CRATE_PRICE = 40;
const FIRST_WEAPON_ID = 101;
const WEAPON_COUNT = 10;
const QUALITY_AVG = 70; // must be greater than 50
const MAX_QUALITY = 100;
const MIN_QUALITY = QUALITY_AVG * 2 - MAX_QUALITY;
const TT_CHANCE = 0.1;

// Shop prices are 2.5x the dismantle value (OwO markupPrices): 3, 8, 13, 63, 750, 2500, 12500.
const MARKUP = {};
for (const [rank, price] of Object.entries(weaponDb.SHARD_PRICES)) MARKUP[rank] = Math.round(price * 2.5);

/* FNV-1a string hash -> 32-bit seed */
function hashSeed(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i += 1) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
}

/* mulberry32 seeded RNG, returns () => [0, 1) */
function seededRng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const availableWeaponIds = () => Object.keys(WeaponInterface.weapons)
    .map(Number)
    .filter((wid) => !WeaponInterface.weapons[wid].disabled)
    .sort((a, b) => a - b);

/* Same cumulative-chance draw as WeaponInterface.setRandomWear (wear ids 2..4 have a chance). */
function pickWear(rng) {
    const rand = rng();
    let chance = 0;
    for (const id of [0, 1, 2, 3, 4]) {
        chance += WeaponInterface.getWear(id).chance;
        if (rand <= chance) return id;
    }
    return 1;
}

const randomQuality = (rng) => Math.floor(rng() * (MAX_QUALITY - MIN_QUALITY + 1)) + MIN_QUALITY;

/* One weapon spec (plain data) for the shop. */
function generateSpec(rng, wids) {
    const wid = wids[Math.floor(rng() * wids.length)];
    const WeaponClass = WeaponInterface.weapons[wid];
    const probe = new WeaponClass(null, null, true);
    const wear = pickWear(rng);
    const hasTT = rng() <= TT_CHANCE;
    const passiveIds = [];
    for (let i = 0; i < probe.passiveCount; i += 1) {
        passiveIds.push(Number(probe.availablePassives[Math.floor(rng() * probe.availablePassives.length)]));
    }
    // Learn the quality counts (buffs/mana add qualities) from a throwaway instance.
    const trial = new WeaponClass(null, null, null, { wear, hasTT, passives: passiveIds });
    const stat = trial.qualities.map(() => randomQuality(rng));
    const passives = trial.passives.map((p) => ({ id: p.id, stat: p.qualities.map(() => randomQuality(rng)) }));
    return { wid, wear, hasTT, stat, passives };
}

/* Spec -> fresh weapon instance (never share an instance: saveWeapon mutates it). */
function buildWeapon(spec) {
    const WeaponClass = WeaponInterface.weapons[spec.wid];
    const passives = spec.passives.map((p) => new WeaponInterface.allPassives[p.id](p.stat.slice(), null, { wear: spec.wear }));
    return new WeaponClass(passives, spec.stat.slice(), null, { wear: spec.wear, hasTT: spec.hasTT, kills: 0 });
}

let cached = { day: null, specs: null };
function getSpecs(day) {
    if (cached.day === day) return cached.specs;
    const rng = seededRng(hashSeed(`soza-weapon-shop:${day}`));
    const wids = availableWeaponIds();
    const specs = [];
    for (let i = 0; i < WEAPON_COUNT; i += 1) specs.push({ shopId: FIRST_WEAPON_ID + i, ...generateSpec(rng, wids) });
    cached = { day, specs };
    return specs;
}

/* Today's offers: [{ shopId, weapon, price, purchased }]. `userId` marks what that user already bought. */
async function getDailyWeapons(userId, now = Date.now()) {
    const day = crateDb.dayNumber(now);
    const bought = new Set();
    if (userId) {
        const rows = await ShopPurchase.find({ userId, day }).lean();
        for (const row of rows) bought.add(row.shopId);
    }
    return getSpecs(day).map((spec) => {
        const weapon = buildWeapon(spec);
        weapon.shopID = spec.shopId;
        return { shopId: spec.shopId, weapon, price: MARKUP[weapon.rank.name], purchased: bought.has(spec.shopId) };
    });
}

/*
 * Buy a shop item with weapon shards.
 * Return { crate: true, price } | { weapon, price, shopId } | { error: 'missing'|'purchased'|'shards' }.
 */
async function buy(userId, id, now = Date.now()) {
    if (id === CRATE_ID) {
        if (!(await crateDb.useShards(userId, CRATE_PRICE))) return { error: 'shards' };
        try {
            await crateDb.addCrates(userId, 1);
        } catch (error) {
            await crateDb.addShards(userId, CRATE_PRICE).catch(() => {});
            throw error;
        }
        return { crate: true, price: CRATE_PRICE };
    }

    const day = crateDb.dayNumber(now);
    const spec = getSpecs(day).find((s) => s.shopId === id);
    if (!spec) return { error: 'missing' };
    const template = buildWeapon(spec);
    const price = MARKUP[template.rank.name];

    // Claim the purchase first (unique index) so two concurrent buys cannot both succeed.
    try {
        await ShopPurchase.create({ userId, day, shopId: id });
    } catch (error) {
        if (error?.code === DUPLICATE_KEY) return { error: 'purchased' };
        throw error;
    }
    const release = () => ShopPurchase.deleteOne({ userId, day, shopId: id }).catch(() => {});
    if (!(await crateDb.useShards(userId, price))) {
        await release();
        return { error: 'shards' };
    }
    try {
        const weapon = await weaponDb.saveWeapon(userId, buildWeapon(spec));
        weapon.shopID = id;
        return { weapon, price, shopId: id };
    } catch (error) {
        await crateDb.addShards(userId, price).catch(() => {});
        await release();
        throw error;
    }
}

module.exports = {
    CRATE_ID, CRATE_PRICE, FIRST_WEAPON_ID, WEAPON_COUNT, MARKUP,
    hashSeed, seededRng, getSpecs, buildWeapon, getDailyWeapons, buy
};
