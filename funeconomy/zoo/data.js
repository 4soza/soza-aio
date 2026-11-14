/**
 * Data hewan untuk hunt, zoo, dan battle (gaya OwO).
 * Dasar rank, harga, poin, dan XP mengikuti OwO (CC BY-NC-SA 4.0, https://github.com/ChristopherBThai/Discord-OwO-Bot).
 * Daftar hewan memakai emoji Unicode. Rank patreon, special (event), dan distorted tidak dipakai.
 */

// rarity = persen peluang tiap hunt. Rank "conditional" hanya muncul lewat gem atau hunt bot.
const RANKS = {
    common:    { order: 1,  emoji: '⚪', alias: ['c'],              rarity: 58.4989, price: 1,       points: 1,      essence: 1,      xp: 1 },
    uncommon:  { order: 2,  emoji: '🟢', alias: ['u', 'uc'],        rarity: 30,      price: 3,       points: 5,      essence: 5,      xp: 10 },
    rare:      { order: 3,  emoji: '🔵', alias: ['r'],              rarity: 10,      price: 10,      points: 20,     essence: 20,     xp: 20 },
    epic:      { order: 4,  emoji: '🟣', alias: ['e'],              rarity: 1,       price: 250,     points: 250,    essence: 250,    xp: 400 },
    mythical:  { order: 7,  emoji: '🔴', alias: ['m', 'mythic'],    rarity: 0.1,     price: 5000,    points: 3000,   essence: 3000,   xp: 1000 },
    gem:       { order: 8,  emoji: '💎', alias: ['g'],              rarity: 0.1,     price: 30000,   points: 20000,  essence: 20000,  xp: 5000 },
    legendary: { order: 9,  emoji: '🟠', alias: ['l', 'legend'],    rarity: 0.3,     price: 15000,   points: 10000,  essence: 10000,  xp: 2000 },
    bot:       { order: 10, emoji: '🤖', alias: ['b'],              rarity: 0,       price: 50000,   points: 30000,  essence: 10000,  xp: 100000, conditional: true },
    fabled:    { order: 13, emoji: '🟡', alias: ['f'],              rarity: 0.001,   price: 250000,  points: 100000, essence: 100000, xp: 100000 },
    hidden:    { order: 14, emoji: '⚫', alias: ['h'],              rarity: 0.0001,  price: 1000000, points: 500000, essence: 500000, xp: 300000 }
};
const RANK_ORDER = Object.keys(RANKS).sort((a, b) => RANKS[a].order - RANKS[b].order);
for (const [id, rank] of Object.entries(RANKS)) rank.id = id;

// [key, emoji, rank, [hp, att, pr, wp, mag, mr], deskripsi, alias]
// Stat mentah dipakai di battle: hp/wp/att/mag naik per level, pr/mr jadi persen resistensi.
const ROSTER = [
    ["bee", "🐝", "common", [1, 5, 2, 3, 3, 1], "How do bees go to school? ~   On the school buzz!", ["bee", "wasp"]],
    ["beetle", "🐞", "common", [4, 2, 2, 3, 2, 2], "Are they all female?", ["beetle", "ladybug"]],
    ["bug", "🐛", "common", [3, 2, 2, 4, 2, 2], "It's a worm.", ["bug", "worm", "caterpillar"]],
    ["butterfly", "🦋", "common", [1, 1, 1, 5, 5, 2], "Why did you throw butter out the window? ~ To see a butter fly!", ["butterfly"]],
    ["snail", "🐌", "common", [8, 1, 2, 3, 5, 1], "The slowest animal, but the toughest in the zoo", ["snail", "slug"]],
    ["crocodile", "🐊", "epic", [3, 4, 4, 2, 1, 4], "How do you tell the difference between an alligator and an crocodile? ~ You will see one later and one in a while", ["crocodile", "alligator"]],
    ["elephant", "🐘", "epic", [5, 5, 3, 1, 1, 3], "They don't actually eat peanuts", ["elephant"]],
    ["penguin", "🐧", "epic", [2, 1, 2, 6, 5, 2], "The birds that can't fly", ["penguin"]],
    ["tiger", "🐅", "epic", [4, 6, 2, 1, 3, 2], "Just a very large kitty", ["tiger", "tiger2", "cheetah"]],
    ["whale", "🐳", "epic", [7, 1, 3, 1, 2, 4], "whale, whale, whale, look what we have here", ["whale"]],
    ["cat", "🐈", "rare", [3, 1, 1, 6, 3, 3], "They shoot lazers.", ["cat", "cat2", "kitty", "kitten"]],
    ["cow", "🐄", "rare", [5, 4, 3, 1, 1, 3], "Some say that they are highly sought-after", ["cow", "cow2"]],
    ["dog", "🐕", "rare", [4, 6, 3, 1, 1, 2], "Very loyal and protective", ["dog", "dog2", "doggy", "puppy", "wolf"]],
    ["pig", "🐖", "rare", [4, 2, 3, 2, 2, 4], "aka ur mum", ["pig", "pig2"]],
    ["sheep", "🐑", "rare", [5, 2, 2, 3, 1, 4], "Tastes like cotten candy!", ["sheep", "ram", "goat"]],
    ["baby_chick", "🐥", "uncommon", [3, 2, 3, 3, 3, 2], "chirp chirp! It's so cute!", ["chick", "baby_chick"]],
    ["chipmunk", "🐿️", "uncommon", [3, 5, 2, 3, 2, 1], "Don't mess with them.", ["chipmunk", "squirrel"]],
    ["mouse", "🐁", "uncommon", [3, 3, 2, 3, 3, 2], "~~sqeak~~ squeak!", ["mouse", "mouse2", "rat"]],
    ["rabbit", "🐇", "uncommon", [3, 4, 2, 3, 2, 2], "There's a ton of them.", ["rabbit", "rabbit2", "bunny"]],
    ["rooster", "🐓", "uncommon", [3, 4, 3, 2, 2, 2], "The alarm cluck", ["chicken", "rooster"]],
    ["unicorn", "🦄", "mythical", [6, 3, 3, 4, 5, 4], "Rainbows follow it everywhere.", ["unicorn"]],
    ["dragon", "🐉", "mythical", [5, 7, 3, 3, 4, 3], "Breathes fire and hoards cash.", ["dragon"]],
    ["lion", "🦁", "mythical", [5, 6, 3, 3, 3, 3], "The king of the zoo.", ["lion"]],
    ["shark", "🦈", "mythical", [4, 7, 2, 3, 3, 3], "Always hungry.", ["shark"]],
    ["gorilla", "🦍", "mythical", [7, 6, 4, 2, 1, 3], "Strong, silent, and loves bananas.", ["gorilla", "ape"]],
    ["octopus", "🐙", "mythical", [4, 3, 2, 4, 7, 4], "Eight arms, zero chill.", ["octopus", "squid"]],
    ["trex", "🦖", "mythical", [6, 7, 3, 2, 2, 3], "Tiny arms, huge bite.", ["trex", "dino", "dinosaur"]],
    ["sauropod", "🦕", "mythical", [8, 3, 4, 3, 2, 4], "A gentle giant from long ago.", ["sauropod", "brontosaurus"]],
    ["eagle", "🦅", "legendary", [5, 7, 3, 4, 4, 4], "Sees everything from above.", ["eagle", "hawk"]],
    ["owl", "🦉", "legendary", [4, 4, 3, 5, 8, 4], "Wise and a little judgy.", ["owl"]],
    ["leopard", "🐆", "legendary", [5, 8, 3, 4, 3, 4], "Fast, spotted, and fierce.", ["leopard", "panther"]],
    ["bison", "🦬", "legendary", [9, 6, 5, 3, 2, 3], "Charges first, asks later.", ["bison", "buffalo"]],
    ["mammoth", "🦣", "legendary", [9, 6, 5, 3, 2, 4], "Frozen in time, thawed for you.", ["mammoth"]],
    ["swan", "🦢", "legendary", [5, 4, 3, 5, 7, 6], "Elegant, but do not get too close.", ["swan"]],
    ["peacock", "🦚", "gem", [6, 5, 4, 5, 6, 5], "Shows off its gem feathers.", ["peacock"]],
    ["parrot", "🦜", "gem", [5, 5, 4, 6, 6, 5], "Repeats everything you say.", ["parrot"]],
    ["flamingo", "🦩", "gem", [6, 4, 5, 6, 6, 5], "Stands on one leg for style.", ["flamingo"]],
    ["dolphin", "🐬", "gem", [6, 5, 4, 6, 7, 5], "So smart it knows your name.", ["dolphin"]],
    ["robot", "🤖", "bot", [7, 5, 6, 5, 5, 5], "Beep boop. Built by the hunt bot.", ["robot"]],
    ["invader", "👾", "bot", [5, 6, 5, 6, 6, 5], "Came from far away to join your zoo.", ["invader", "alien"]],
    ["ufo", "🛸", "bot", [6, 5, 5, 6, 7, 5], "Unidentified, but definitely yours.", ["ufo"]],
    ["teddy", "🧸", "bot", [8, 4, 6, 5, 4, 6], "The cutest thing the hunt bot ever found.", ["teddy", "bear"]],
    ["elderdragon", "🐲", "fabled", [8, 8, 6, 6, 6, 5], "An ancient dragon that rarely shows itself.", ["elderdragon", "fabled"]],
    ["scorpion", "🦂", "fabled", [6, 9, 6, 6, 5, 6], "One sting is all it takes.", ["scorpion"]],
    ["bat", "🦇", "fabled", [6, 7, 5, 8, 8, 6], "Rules the night.", ["bat"]],
    ["otter", "🦦", "fabled", [7, 7, 6, 7, 8, 6], "Holds hands while it sleeps.", ["otter"]],
    ["gspider", "🕷️", "gem", [5, 7, 4, 5, 6, 4], "Spins webs made of gems.", ["gspider"]],
    ["gshrimp", "🦐", "gem", [4, 6, 3, 7, 7, 4], "Small, shiny, and surprisingly strong.", ["gshrimp"]],
    ["gpanda", "🐼", "gem", [8, 5, 5, 4, 4, 5], "Eats bamboo and gem dust.", ["gpanda"]],
    ["gfish", "🐟", "gem", [5, 5, 4, 6, 7, 5], "Swims through crystal water.", ["gfish"]],
    ["gcamel", "🐫", "gem", [8, 5, 5, 5, 5, 5], "Carries a whole desert of treasure.", ["gcamel"]],
    ["lsquid", "🦑", "legendary", [5, 5, 3, 5, 8, 5], "Hides in the dark and strikes with ink.", ["lsquid"]],
    ["lowl", "🦉", "legendary", [4, 5, 3, 6, 8, 4], "Watches over the night.", ["lowl"]],
    ["llion", "🦁", "legendary", [6, 8, 4, 3, 3, 4], "A golden mane and a loud roar.", ["llion"]],
    ["lfox", "🦊", "legendary", [4, 6, 3, 6, 7, 4], "Clever, quick, and never caught.", ["lfox"]],
    ["ldeer", "🦌", "legendary", [6, 5, 4, 5, 5, 6], "Graceful, with antlers like a crown.", ["ldeer"]],
    ["fwolf", "🐺", "fabled", [7, 9, 5, 6, 5, 6], "Leads the pack under a full moon.", ["fwolf"]],
    ["fgorilla", "🦍", "fabled", [9, 9, 7, 5, 4, 6], "The strongest of the jungle.", ["fgorilla"]],
    ["ffrog", "🐸", "fabled", [6, 6, 6, 8, 8, 7], "A tiny prince of magic.", ["ffrog"]],
    ["feagle", "🦅", "fabled", [6, 9, 5, 7, 7, 6], "Rules the sky above the clouds.", ["feagle"]],
    ["fboar", "🐗", "fabled", [9, 8, 8, 5, 4, 7], "Nothing stops its charge.", ["fboar"]],
    ["sloth", "🦥", "hidden", [10, 8, 8, 8, 8, 8], "Takes its time, then wins.", ["sloth"]],
    ["hedgehog", "🦔", "hidden", [9, 9, 9, 8, 8, 8], "Prickly on the outside, rare on the inside.", ["hedgehog"]],
    ["beaver", "🦫", "hidden", [10, 9, 8, 9, 8, 8], "Builds legends one log at a time.", ["beaver"]],
];

const ANIMALS = {};
const ANIMAL_ALIASES = {};
for (const [key, uni, rank, s, desc, alias] of ROSTER) {
    ANIMALS[key] = {
        key, name: key, value: uni, uni, rank, desc, alias,
        hpr: s[0], attr: s[1], prr: s[2], wpr: s[3], magr: s[4], mrr: s[5]
    };
    for (const a of [key, ...alias]) ANIMAL_ALIASES[a.toLowerCase()] = key;
    ANIMAL_ALIASES[uni] = key;
}

const RANK_ALIASES = {};
for (const [id, rank] of Object.entries(RANKS)) {
    RANK_ALIASES[id] = id;
    for (const a of rank.alias) RANK_ALIASES[a] = id;
}

const ANIMALS_BY_RANK = {};
for (const id of RANK_ORDER) ANIMALS_BY_RANK[id] = [];
for (const animal of Object.values(ANIMALS)) ANIMALS_BY_RANK[animal.rank].push(animal.key);

/** Cari hewan dari nama, alias, atau emoji. Return objek hewan atau null. */
function findAnimal(token) {
    const key = ANIMAL_ALIASES[String(token || '').toLowerCase()] || ANIMAL_ALIASES[String(token || '')];
    return key ? ANIMALS[key] : null;
}

/** Cari rank dari nama atau alias (c, u, r, e, m, l, g, b, f, h). */
function findRank(token) {
    const id = RANK_ALIASES[String(token || '').toLowerCase()];
    return id ? RANKS[id] : null;
}

/** Hitung nilai zoo (poin) dari map { key: jumlah }. */
function zooPoints(counts) {
    let total = 0;
    for (const [key, n] of Object.entries(counts)) {
        const animal = ANIMALS[key];
        if (animal) total += RANKS[animal.rank].points * n;
    }
    return total;
}

module.exports = { RANKS, RANK_ORDER, ANIMALS, ANIMALS_BY_RANK, findAnimal, findRank, zooPoints };
                                
