/**
 * Pindahkan hewan lama ke hewan baru yang menggantikannya (supaya tidak ada hewan dobel di zoo).
 * Aman dijalankan berulang: kalau tidak ada data lama, tidak melakukan apa-apa.
 */
const Animal = require('../../models/funeconomy/animal');
const Team = require('../../models/funeconomy/team');
const Weapon = require('../../models/funeconomy/weapon');

// hewan lama -> hewan baru
const RENAMES = { eagle: 'feagle', owl: 'lowl', lion: 'llion', gorilla: 'fgorilla' };

async function migrateOne(oldKey, newKey) {
    const olds = await Animal.find({ name: oldKey }).lean();
    for (const old of olds) {
        const target = await Animal.findOne({ userId: old.userId, name: newKey }).lean();
        if (target) {
            // Sudah punya hewan baru: gabungkan jumlahnya, senjata hewan lama dilepas dari hewan.
            await Animal.updateOne({ userId: old.userId, name: newKey }, { $inc: {
                count: old.count || 0, totalcount: old.totalcount || 0, xp: old.xp || 0,
                sellcount: old.sellcount || 0, saccount: old.saccount || 0
            } });
            await Weapon.updateMany({ userId: old.userId, animal: oldKey }, { $set: { animal: null } });
            await Animal.deleteOne({ userId: old.userId, name: oldKey });
        } else {
            await Animal.updateOne({ userId: old.userId, name: oldKey }, { $set: { name: newKey } });
            await Weapon.updateMany({ userId: old.userId, animal: oldKey }, { $set: { animal: newKey } });
        }
        const teamDoc = await Team.findOne({ userId: old.userId }).lean();
        if (teamDoc?.teams?.some((t) => (t.slots || []).includes(oldKey))) {
            const teams = teamDoc.teams.map((t) => ({
                ...t, slots: (t.slots || []).map((slot) => (slot === oldKey ? newKey : slot))
            }));
            await Team.updateOne({ userId: old.userId }, { $set: { teams } });
        }
    }
    return olds.length;
}

async function migrateAnimals() {
    let moved = 0;
    for (const [oldKey, newKey] of Object.entries(RENAMES)) moved += await migrateOne(oldKey, newKey);
    if (moved) console.log(`[FUNECONOMY] Dipindahkan ${moved} data hewan lama ke hewan baru.`);
    return moved;
}

module.exports = { RENAMES, migrateAnimals };
