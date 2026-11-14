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
    unknown: { fallback: '❓' }, // tanda tanya hitam untuk hewan yang belum didapat di zoo
    // lootbox: lb1 diam, lb2 bergerak, lb3 terbuka. crate senjata: cr1 diam, cr2 bergerak, cr3 terbuka.
    lb1: { fallback: '📦' },
    lb2: { animated: true, fallback: '📦' },
    lb3: { animated: true, fallback: '🎁' },
    cr1: { fallback: '📦' },
    cr2: { animated: true, fallback: '📦' },
    cr3: { animated: true, fallback: '📦' }
};

// Ikon senjata (w_<nama>) dan passive (p_<nama>), nama = nama class di funeconomy/battle/weapons|passives.
// Tanpa fallback di sini: emoji Unicode bawaan tiap senjata/passive tetap dipakai kalau emoji kustom belum ada.
const WEAPON_NAMES = ['AbsorbWand', 'ArcaneScepter', 'Bow', 'CelebrationRune', 'CullingScythe', 'EnergyStaff', 'FlameStaff',
    'FoulFish', 'GlacialAxe', 'Greatsword', 'HealStaff', 'LeechScythe', 'LuckRune', 'Orb', 'PoisonDagger', 'PurityStaff',
    'ResurrectionStaff', 'Rune', 'Shield', 'SpiritStaff', 'VampiricStaff', 'VanguardsBanner',
    // senjata baru (khusus bot ini)
    'ConduitClaw', 'Crossbow', 'DruidStaff', 'EyeStaff', 'FrostStaff'];
const PASSIVE_NAMES = ['Absolve', 'Critical', 'Discharge', 'Energize', 'Enrage', 'HealthPoint', 'Kamikaze', 'Knowledge',
    'Lifesteal', 'Magic', 'MagicResist', 'Manatap', 'PhysicalResist', 'Regeneration', 'Sacrifice', 'Safeguard', 'Snail',
    'Sprout', 'Strength', 'Thorns', 'WeaponPoint',
    // passive baru (khusus bot ini)
    'Rend', 'Execute', 'Photosynthesis', 'Tide', 'Ferocity', 'Sharpness', 'Wildfire', 'Frostbite', 'Lifebloom'];
for (const name of WEAPON_NAMES) DEFS[`w_${name.toLowerCase()}`] = { fallback: '' };
for (const name of PASSIVE_NAMES) DEFS[`p_${name.toLowerCase()}`] = { fallback: '' };
// Robot HuntBot per rarity: <huruf rank>hb (chb, uhb, rhb, ehb, mhb, lhb, fhb); legendary dan fabled animasi.
const ROBOT_KEYS = { common: 'chb', uncommon: 'uhb', rare: 'rhb', epic: 'ehb', mythic: 'mhb', legendary: 'lhb', fabled: 'fhb' };
for (const [rank, key] of Object.entries(ROBOT_KEYS)) DEFS[key] = { fallback: '🤖', animated: rank === 'legendary' || rank === 'fabled' };
// Emoji hewan baru per rarity (key hewan = nama file); semuanya animasi.
const ANIMAL_EMOJI = {
    gspider: '🕷️', gshrimp: '🦐', gpanda: '🐼', gfish: '🐟', gcamel: '🐫',
    lsquid: '🦑', lowl: '🦉', llion: '🦁', lfox: '🦊', ldeer: '🦌',
    fwolf: '🐺', fgorilla: '🦍', ffrog: '🐸', feagle: '🦅', fboar: '🐗'
};
for (const [key, fallback] of Object.entries(ANIMAL_EMOJI)) DEFS[key] = { animated: true, fallback };
DEFS.floot = { animated: true, fallback: '🎁' }; // fabled lootbox
// Ikon buff/debuff di samping nama hewan (b_<nama>), key = id buff di funeconomy/battle/buffs.
const BUFF_KEYS = { 1: 'b_taunt', 2: 'b_poison', 3: 'b_flame', 4: 'b_defenseup', 5: 'b_freeze', 6: 'b_attackup',
    7: 'b_attackupplus', 8: 'b_attackupplusplus', 9: 'b_mortality', 10: 'b_celebration', 11: 'b_leech', 12: 'b_stinky' };
for (const key of Object.values(BUFF_KEYS)) DEFS[key] = { fallback: '' };
// Gem buff (cgem1..fgem4): huruf = rarity (c u r e m l f), angka = bentuk (1 permata, 2 lingkaran, 3 hati, 4 bintang).
const GEM_LETTERS = ['c', 'u', 'r', 'e', 'm', 'l', 'f'];
for (const letter of GEM_LETTERS) {
    for (let shape = 1; shape <= 4; shape += 1) DEFS[`${letter}gem${shape}`] = { fallback: '', animated: letter === 'l' || letter === 'f' };
}
// Tipe gem di zoo/gems.js -> bentuk emoji.
const GEM_SHAPES = { Hunting: 1, Empowering: 2, Lucky: 3 };

// Ikon weapon tanpa bingkai untuk inventory (assets/emoji/wi_<nama>.png). Opsional: kalau tidak ada, inventory memakai ikon w_ yang berbingkai.
try {
    for (const file of fs.readdirSync(DIR)) {
        const match = /^(wi_[a-z0-9]+)\.png$/.exec(file);
        if (match) DEFS[match[1]] = { fallback: '' };
    }
} catch { /* tanpa folder assets */ }

const live = new Map(); // key -> '<:nama:id>'

const get = (key) => live.get(key) ?? DEFS[key]?.fallback ?? '';
/** Emoji kustom senjata ('w') atau passive ('p') untuk class tertentu; null kalau belum tersedia. */
// Nama class di dalam file kadang beda dari nama file (PStaff, Snail untuk Knowledge, dst.), jadi dicari lewat id.
const GEAR_BY_ID = { w: new Map(), p: new Map() };
for (const [kind, dir] of [['w', 'weapons'], ['p', 'passives']]) {
    const folder = path.join(__dirname, 'battle', dir);
    try {
        for (const file of fs.readdirSync(folder)) {
            if (!file.endsWith('.js')) continue;
            const id = /this\.id\s*=\s*(\d+)/.exec(fs.readFileSync(path.join(folder, file), 'utf8'))?.[1];
            if (id) GEAR_BY_ID[kind].set(Number(id), file.slice(0, -3).toLowerCase());
        }
    } catch { /* tanpa folder: pakai nama class saja */ }
}
const gear = (kind, className, id) => {
    const byId = id != null ? GEAR_BY_ID[kind === 'wi' ? 'w' : kind]?.get(Number(id)) : null; // wi_ = ikon inventory, id sama dengan weapon
    return live.get(`${kind}_${byId || String(className).toLowerCase()}`) || null;
};
/** Emoji kustom buff menurut id buff; null kalau belum tersedia. */
const buff = (id) => live.get(BUFF_KEYS[id]) || null;
const floot = () => get('floot');
const robot = (rank) => get(ROBOT_KEYS[rank]);
const shard = () => get('shard');
const unknown = () => get('unknown');
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
    const { GEMS } = require('./zoo/gems');
    for (const gem of Object.values(GEMS)) {
        const custom = live.get(`${gem.key.slice(0, 1)}gem${GEM_SHAPES[gem.type]}`);
        gem.emoji = custom || `${gem.icon}${RANKS[gem.rank].emoji}`;
    }
    const { ANIMALS } = require('./zoo/data');
    for (const [key, fallback] of Object.entries(ANIMAL_EMOJI)) {
        if (!ANIMALS[key]) continue;
        const emoji = live.get(key) || fallback;
        ANIMALS[key].uni = emoji;
        ANIMALS[key].value = emoji;
    }
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

module.exports = { DEFS, get, gear, buff, robot, floot, shard, unknown, crate, crateShake, crateOpen, lootbox, lootboxShake, lootboxOpen, apply, sync, reset, customId };
        
