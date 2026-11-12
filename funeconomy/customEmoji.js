/*
 * Emoji kustom bot (rarity, cincin, weapon shard, crate, lootbox). Gambarnya ada di assets/emoji/*.png.
 * Saat bot siap, semuanya diunggah otomatis sebagai Application Emoji (kalau belum ada), lalu dipakai di
 * seluruh teks economy. Kalau gagal diunggah, otomatis kembali ke emoji Unicode bawaan.
 */
const fs = require('node:fs');
const path = require('node:path');

const DIR = path.join(__dirname, '..', 'assets', 'emoji');
// key = nama emoji di Discord = nama file di assets/emoji (png, atau gif kalau animated).
// fallback = emoji Unicode kalau emoji kustom belum tersedia.
const DEFS = {
    common: { fallback: '⚪' },
    uncommon: { fallback: '🟢' },
    rare: { fallback: '🔵' },
    epic: { fallback: '🟣' },
    mythic: { fallback: '🔴' },
    legendary: { animated: true, fallback: '🟠' },
    fabled: { animated: true, fallback: '🟡' },
    gem: { animated: true, fallback: '💎' },
    special: { fallback: '🌈' },
    cring: { fallback: '⚪💍' },
    uring: { fallback: '🟢💍' },
    rring: { fallback: '🔵💍' },
    ering: { fallback: '🟣💍' },
    mring: { fallback: '🔴💍' },
    lring: { animated: true, fallback: '🟠💍' },
    fring: { animated: true, fallback: '🟡💍' },
    shard: { fallback: '🧩' },
    // lootbox: lb1 diam, lb2 bergerak, lb3 terbuka. crate senjata: cr1 diam, cr2 bergerak, cr3 terbuka.
    lb1: { fallback: '📦' },
    lb2: { animated: true, fallback: '📦' },
    lb3: { animated: true, fallback: '🎁' },
    cr1: { fallback: '📦' },
    cr2: { animated: true, fallback: '📦' },
    cr3: { animated: true, fallback: '📦' }
};

const live = new Map(); // key -> '<:nama:id>'

const get = (key) => live.get(key) ?? DEFS[key]?.fallback ?? '';
const shard = () => get('shard');
const crate = () => get('cr1');
const crateShake = () => get('cr2');
const crateOpen = () => get('cr3');
const lootbox = () => get('lb1');
const lootboxShake = () => get('lb2');
const lootboxOpen = () => get('lb3');

// Rank hewan (zoo/data.js RANKS) dan rank senjata (WeaponInterface.ranks) -> key emoji.
const ZOO_RANKS = {
    common: 'common', uncommon: 'uncommon', rare: 'rare', epic: 'epic',
    mythical: 'mythic', gem: 'gem', legendary: 'legendary', fabled: 'fabled'
};
const WEAPON_RANKS = {
    Common: 'common', Uncommon: 'uncommon', Rare: 'rare', Epic: 'epic',
    Mythical: 'mythic', Legendary: 'legendary', Fabled: 'fabled'
};
// Cincin (shop/ringShop.js RINGS): id -> key emoji.
const RINGS = { 1: 'cring', 2: 'uring', 3: 'rring', 4: 'ering', 5: 'mring', 6: 'lring', 7: 'fring' };

/** Pasang emoji yang tersedia ke data rank (diubah di tempat, dibaca saat dipakai). */
function apply() {
    const { RANKS } = require('./zoo/data');
    for (const [rank, key] of Object.entries(ZOO_RANKS)) if (RANKS[rank]) RANKS[rank].emoji = get(key);
    const { ranks } = require('./battle/WeaponInterface');
    for (const entry of ranks) if (WEAPON_RANKS[entry[1]]) entry[2] = get(WEAPON_RANKS[entry[1]]);
    const ringShop = require('./shop/ringShop');
    for (const [id, key] of Object.entries(RINGS)) if (ringShop.RINGS[id]) ringShop.RINGS[id].emoji = get(key);
}

/** Unggah emoji yang belum ada lalu pakai. Tidak pernah melempar error: yang gagal tetap pakai Unicode. */
async function sync(client) {
    const store = client?.application?.emojis;
    if (!store?.fetch || !store?.create) {
        console.warn('[FUNECONOMY] Application emoji tidak tersedia, memakai emoji Unicode.');
        return 0;
    }
    let existing;
    try {
        existing = await store.fetch();
    } catch (error) {
        console.warn(`[FUNECONOMY] Gagal membaca application emoji: ${error.message}`);
        return 0;
    }
    for (const key of Object.keys(DEFS)) {
        const animated = !!DEFS[key].animated;
        const name = key;
        try {
            let emoji = existing.find((e) => e.name === name);
            if (!emoji) {
                emoji = await store.create({ attachment: fs.readFileSync(path.join(DIR, `${key}.${animated ? 'gif' : 'png'}`)), name });
            }
            live.set(key, `<${animated ? 'a' : ''}:${name}:${emoji.id}>`);
        } catch (error) {
            console.warn(`[FUNECONOMY] Emoji ${name} gagal dipakai (${error.message}), memakai Unicode.`);
        }
    }
    apply();
    return live.size;
}

/** Untuk tes: hapus semua emoji kustom dan kembalikan ke Unicode. */
function reset() { live.clear(); apply(); }

/** id emoji kustom dari teks `<:nama:id>` (atau null untuk emoji Unicode). */
const customId = (text) => /^<a?:\w+:(\d+)>$/.exec(String(text || ''))?.[1] || null;

module.exports = { DEFS, get, shard, crate, crateShake, crateOpen, lootbox, lootboxShake, lootboxOpen, apply, sync, reset, customId };
