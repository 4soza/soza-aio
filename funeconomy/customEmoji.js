/*
 * Emoji kustom bot (rarity, weapon shard, crate, lootbox). Gambarnya ada di assets/emoji/*.png.
 * Saat bot siap, semuanya diunggah otomatis sebagai Application Emoji (kalau belum ada), lalu dipakai di
 * seluruh teks economy. Kalau gagal diunggah, otomatis kembali ke emoji Unicode bawaan.
 */
const fs = require('node:fs');
const path = require('node:path');

const DIR = path.join(__dirname, '..', 'assets', 'emoji');
const NAME_PREFIX = 'soza_';

// key = nama file (tanpa ekstensi). animated = file .gif (emoji bergerak), selain itu .png.
// fallback = emoji Unicode kalau emoji kustom belum tersedia.
const DEFS = {
    rarity_common: { fallback: '⚪' },
    rarity_uncommon: { fallback: '🟢' },
    rarity_rare: { fallback: '🔵' },
    rarity_epic: { fallback: '🟣' },
    rarity_mythic: { fallback: '🔴' },
    rarity_legendary: { animated: true, fallback: '🟠' },
    rarity_fabled: { animated: true, fallback: '🟡' },
    rarity_gem: { animated: true, fallback: '💎' },
    rarity_special: { fallback: '🌈' },
    item_weapon_shard: { fallback: '🧩' },
    item_crate: { fallback: '📦' },
    item_lootbox: { fallback: '📦' }
};

const live = new Map(); // key -> '<:nama:id>'

const get = (key) => live.get(key) ?? DEFS[key]?.fallback ?? '';
const shard = () => get('item_weapon_shard');
const crate = () => get('item_crate');
const lootbox = () => get('item_lootbox');

// Rank hewan (zoo/data.js RANKS) dan rank senjata (WeaponInterface.ranks) -> key emoji.
const ZOO_RANKS = {
    common: 'rarity_common', uncommon: 'rarity_uncommon', rare: 'rarity_rare', epic: 'rarity_epic',
    mythical: 'rarity_mythic', gem: 'rarity_gem', legendary: 'rarity_legendary', fabled: 'rarity_fabled'
};
const WEAPON_RANKS = {
    Common: 'rarity_common', Uncommon: 'rarity_uncommon', Rare: 'rarity_rare', Epic: 'rarity_epic',
    Mythical: 'rarity_mythic', Legendary: 'rarity_legendary', Fabled: 'rarity_fabled'
};

/** Pasang emoji yang tersedia ke data rank (diubah di tempat, dibaca saat dipakai). */
function apply() {
    const { RANKS } = require('./zoo/data');
    for (const [rank, key] of Object.entries(ZOO_RANKS)) if (RANKS[rank]) RANKS[rank].emoji = get(key);
    const { ranks } = require('./battle/WeaponInterface');
    for (const entry of ranks) if (WEAPON_RANKS[entry[1]]) entry[2] = get(WEAPON_RANKS[entry[1]]);
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
        // Emoji bergerak diberi akhiran _a supaya tidak bentrok dengan emoji statis lama bernama sama.
        const name = `${NAME_PREFIX}${key}${animated ? '_a' : ''}`;
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

module.exports = { DEFS, get, shard, crate, lootbox, apply, sync, reset, customId };
