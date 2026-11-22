/*
 * Guild boss ala OwO: satu boss aktif per server, HP bersama, pemain boleh melawan bersamaan.
 * Kalau boss kalah atau kabur (1 jam), boss baru muncul otomatis saat ada yang membuka boss.
 * Jumlah/angka (level, pengali HP, hadiah) adalah tebakan dari video OwO dan mudah diubah di CONFIG.
 */
const GuildBoss = require('../../models/funeconomy/guildBoss');
const BossTicket = require('../../models/funeconomy/bossTicket');
const { ANIMALS } = require('../zoo/data');
const animalUtil = require('../battle/animalUtil');
const animalClass = require('../battle/animalClass');
const weaponDb = require('../battle/weaponDb');
const teamUtil = require('../battle/teamUtil');
const crateDb = require('../battle/crateDb');
const BattleEvent = require('../battle/battleEvent');

const CONFIG = {
    BOSS_ANIMALS: 3,
    STAY_MS: 60 * 60 * 1000, // boss kabur setelah 1 jam
    HP_MULT: 330, // pengali HP boss dari stat hewan biasa (level 11-12 sekitar 200 ribu per hewan, seperti OwO)
    BASE_LEVEL: 10, // level boss pertama; naik 1 tiap boss dikalahkan (maks MAX_LEVEL)
    MAX_LEVEL: 60,
    TICKETS_PER_DAY: 3,
    SPAWN_RANKS: ['common', 'uncommon', 'rare', 'epic']
};

/* ---- Tiket ---- */
async function ticketsLeft(userId, now = Date.now()) {
    const doc = await BossTicket.findOne({ userId }).lean();
    if (!doc || doc.day !== crateDb.dayNumber(now)) return CONFIG.TICKETS_PER_DAY;
    return Math.max(0, CONFIG.TICKETS_PER_DAY - (doc.used || 0));
}

/* Pakai satu tiket (atomik). Return true kalau berhasil. */
async function useTicket(userId, now = Date.now()) {
    const today = crateDb.dayNumber(now);
    await BossTicket.updateOne({ userId }, { $setOnInsert: { day: -1, used: 0 } }, { upsert: true })
        .catch((error) => { if (error?.code !== 11000) throw error; });
    const same = await BossTicket.findOneAndUpdate(
        { userId, day: today, used: { $lt: CONFIG.TICKETS_PER_DAY } }, { $inc: { used: 1 } }, { new: true }
    ).lean();
    if (same) return true;
    const reset = await BossTicket.findOneAndUpdate(
        { userId, day: { $ne: today } }, { $set: { day: today, used: 1 } }, { new: true }
    ).lean();
    return !!reset;
}

const refundTicket = (userId) => BossTicket.updateOne({ userId, used: { $gt: 0 } }, { $inc: { used: -1 } }).catch(() => {});

/* ---- Boss ---- */
const pick = (list) => list[Math.floor(Math.random() * list.length)];

function weaponDocFor(key) {
    const ids = animalClass.weaponIdsFor(ANIMALS[key]);
    const weapon = weaponDb.randomWeapon(ids.length ? pick(ids) : undefined);
    return { wid: weapon.id, stat: weapon.qualities.slice(), passives: weapon.passives.map((p) => ({ id: p.id, stat: p.qualities.slice() })), wear: weapon.wear?.id || 0 };
}

/* Hewan battle dari dokumen boss (HP sekarang dari database). */
function buildAnimals(doc) {
    return doc.animals.map((a, i) => {
        const data = ANIMALS[a.key];
        const animal = {
            pid: `boss:${doc._id}:${i}`, key: a.key, animal: data, nickname: data.name, pos: i + 1,
            xp: animalUtil.xpForLevel(a.level), buffs: [], debuffs: [], isBoss: true
        };
        if (a.weapon) animal.weapon = weaponDb.parseWeapon(a.weapon);
        animalUtil.stats(animal);
        const s = animal.stats;
        for (const k of [1, 2, 3]) s.hp[k] *= CONFIG.HP_MULT;
        s.hp[0] = Math.max(0, Math.min(a.hp, s.hp[1] + s.hp[3]));
        return animal;
    });
}

function rewardsFor(level) {
    return { shards: 30 + level * 3, crates: 1, bossCrates: 1, xp: level * 900 };
}

async function spawn(guildId, now = Date.now()) {
    const defeated = await GuildBoss.countDocuments({ guildId, status: 'defeated' });
    const level = Math.min(CONFIG.MAX_LEVEL, CONFIG.BASE_LEVEL + defeated);
    const pool = Object.values(ANIMALS).filter((a) => CONFIG.SPAWN_RANKS.includes(a.rank) && !a.event);
    const chosen = [];
    while (chosen.length < CONFIG.BOSS_ANIMALS && chosen.length < pool.length) {
        const a = pick(pool);
        if (!chosen.includes(a)) chosen.push(a);
    }
    const draft = chosen.map((a) => ({ key: a.key, level, hp: 1, hpMax: 1, weapon: weaponDocFor(a.key) }));
    // HP penuh dihitung dari stat yang sama dengan yang dipakai saat battle
    const animals = buildAnimals({ _id: 'new', animals: draft }).map((an, i) => {
        const max = Math.round(an.stats.hp[1] + an.stats.hp[3]);
        return { ...draft[i], hp: max, hpMax: max };
    });
    const total = await GuildBoss.countDocuments({ guildId });
    return GuildBoss.create({
        guildId, no: total + 1, level, animals, endsAt: new Date(now + CONFIG.STAY_MS), rewards: rewardsFor(level)
    });
}

/* Boss aktif server ini; kalau belum ada (atau sudah kabur) muncul boss baru. */
async function currentBoss(guildId, now = Date.now()) {
    let boss = await GuildBoss.findOne({ guildId, status: 'active' });
    if (boss && boss.endsAt.getTime() <= now) {
        await GuildBoss.updateOne({ _id: boss._id, status: 'active' }, { $set: { status: 'fled' } });
        boss = null;
    }
    if (boss) return boss;
    try {
        return await spawn(guildId, now);
    } catch (error) {
        if (error?.code === 11000) return GuildBoss.findOne({ guildId, status: 'active' }); // proses lain sudah memunculkan boss
        throw error;
    }
}

const defeatedCount = (guildId) => GuildBoss.countDocuments({ guildId, status: 'defeated' });
const isAlive = (doc) => doc.animals.some((a) => a.hp > 0);

/* Damage terbanyak: [{ userId, damage }] */
function topDamage(doc, limit = 10) {
    const entries = [];
    for (const [userId, damage] of (doc.damage instanceof Map ? doc.damage : new Map(Object.entries(doc.damage || {})))) entries.push({ userId, damage });
    return entries.sort((a, b) => b.damage - a.damage).slice(0, limit);
}

/* Bagikan hadiah ke semua yang pernah memberi damage. */
async function giveRewards(doc) {
    const r = doc.rewards;
    const ids = topDamage(doc, 10000).filter((e) => e.damage > 0).map((e) => e.userId);
    await Promise.all(ids.map(async (userId) => {
        try {
            await Promise.all([
                crateDb.addShards(userId, r.shards),
                crateDb.addCrates(userId, r.crates),
                crateDb.addBossCrates(userId, r.bossCrates),
                teamUtil.giveXpToUserTeams(userId, r.xp)
            ]);
        } catch (error) {
            console.error('[BOSS] Reward failed for', userId, error);
        }
    }));
    return ids.length;
}

/*
 * Satu pertarungan melawan boss. Mengurangi HP boss di database, mencatat damage, dan membagi hadiah
 * kalau boss kalah. Return { event, damage, finished, rewardedCount, doc } atau { error }.
 */
async function fight({ bossId, userId, playerTeam, playerName }) {
    const doc = await GuildBoss.findById(bossId);
    if (!doc || doc.status !== 'active' || doc.endsAt.getTime() <= Date.now()) return { error: 'inactive' };

    const boss = buildAnimals(doc);
    const before = boss.map((a) => a.stats.hp[0]);
    const event = new BattleEvent({ friendly: true, playerName, enemyName: 'Guild Boss' });
    event.init(playerTeam, { userId: null, index: 0, name: 'Guild Boss', streak: 0, team: boss });
    event.simulateBattle();

    const deltas = boss.map((a, i) => Math.round(before[i] - Math.max(0, a.stats.hp[0]))); // negatif = boss menyembuhkan diri
    const damage = deltas.reduce((sum, d) => sum + Math.max(0, d), 0);

    const inc = { [`damage.${userId}`]: damage };
    deltas.forEach((d, i) => { if (d) inc[`animals.${i}.hp`] = -d; });
    const applied = await GuildBoss.updateOne({ _id: doc._id, status: 'active' }, { $inc: inc, $addToSet: { fighters: userId } });
    if (!applied.matchedCount) return { error: 'inactive' };
    // Jaga HP tetap di 0..hpMax
    await GuildBoss.updateOne({ _id: doc._id }, { $max: Object.fromEntries(doc.animals.map((_, i) => [`animals.${i}.hp`, 0])) });
    if (deltas.some((d) => d < 0)) {
        await GuildBoss.updateOne({ _id: doc._id }, { $min: Object.fromEntries(doc.animals.map((a, i) => [`animals.${i}.hp`, a.hpMax])) });
    }

    let fresh = await GuildBoss.findById(doc._id);
    let finished = false;
    let rewardedCount = 0;
    if (fresh && !isAlive(fresh)) {
        const won = await GuildBoss.findOneAndUpdate({ _id: doc._id, status: 'active' }, { $set: { status: 'defeated' } }, { new: true });
        if (won) { finished = true; fresh = won; rewardedCount = await giveRewards(won); }
    }

    event.endResult.text = finished
        ? `You dealt ${damage.toLocaleString('en-US')} damage and defeated the boss!`
        : `You dealt ${damage.toLocaleString('en-US')} damage to the boss!`;
    event.endResult.color = 0x7ab8f5;
    return { event, damage, finished, rewardedCount, doc: fresh };
}

module.exports = {
    CONFIG, ticketsLeft, useTicket, refundTicket, currentBoss, defeatedCount, buildAnimals, topDamage, isAlive, fight, spawn
};
