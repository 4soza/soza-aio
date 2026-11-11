// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
const Animal = require('../../models/funeconomy/animal');
const { ANIMALS } = require('./data');

/** Tambah hewan ke zoo. `counts` = { key: jumlah }. Dokumen dibuat kalau belum ada. */
async function addAnimals(userId, counts) {
    const ops = Object.entries(counts)
        .filter(([key, n]) => ANIMALS[key] && Number.isSafeInteger(n) && n > 0)
        .map(([key, n]) => ({
            updateOne: {
                filter: { userId, name: key },
                update: { $inc: { count: n, totalcount: n } },
                upsert: true
            }
        }));
    if (ops.length) await Animal.bulkWrite(ops, { ordered: false });
}

/** Ambil semua hewan yang dimiliki (count > 0) sebagai array dokumen. */
async function getZoo(userId) {
    return Animal.find({ userId, count: { $gt: 0 } }).lean();
}

/** Ambil satu dokumen hewan (boleh count 0, mis. hewan yang pernah ada). */
async function getAnimalDoc(userId, name) {
    return Animal.findOne({ userId, name }).lean();
}

/** Ambil hewan secara atomik. Return dokumen baru, atau null kalau jumlahnya tidak cukup. */
async function takeAnimal(userId, name, amount, extraInc = {}) {
    return Animal.findOneAndUpdate(
        { userId, name, count: { $gte: amount } },
        { $inc: { count: -amount, ...extraInc } },
        { new: true }
    ).lean();
}

/** Tambah XP battle ke beberapa hewan milik user. */
async function giveXp(userId, names, xp) {
    if (!names.length || !(xp > 0)) return;
    await Animal.updateMany({ userId, name: { $in: names } }, { $inc: { xp } });
}

/**
 * Ambil hewan untuk dijual/dikorbankan. `count` angka atau 'all'. `field` = 'sellcount' | 'saccount'.
 * Return jumlah yang benar-benar diambil (0 kalau tidak cukup).
 */
async function takeForExchange(userId, name, count, field) {
    let amount = count;
    if (count === 'all') {
        const doc = await getAnimalDoc(userId, name);
        amount = doc?.count || 0;
    }
    if (!(amount > 0)) return 0;
    const updated = await takeAnimal(userId, name, amount, { [field]: amount });
    return updated ? amount : 0;
}

/** Ambil semua hewan dari rank tertentu. Return { rankId: jumlah } yang berhasil diambil. */
async function takeRanks(userId, rankIds, field) {
    const set = new Set(rankIds);
    const taken = {};
    for (const doc of await getZoo(userId)) {
        const animal = ANIMALS[doc.name];
        if (!animal || !set.has(animal.rank)) continue;
        const updated = await takeAnimal(userId, doc.name, doc.count, { [field]: doc.count });
        if (updated) taken[animal.rank] = (taken[animal.rank] || 0) + doc.count;
    }
    return taken;
}

module.exports = { addAnimals, getZoo, getAnimalDoc, takeAnimal, giveXp, takeForExchange, takeRanks };
