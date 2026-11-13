/*
 * Task harian/mingguan dan quest: progres, hadiah, dan penyimpanan.
 * Semua perubahan memakai update atomik supaya aman kalau dua perintah berjalan bersamaan.
 */
const cfg = require('../config');
const Quest = require('../../models/funeconomy/quest');
const Economy = require('../../models/funeconomy/economy');
const Lootbox = require('../../models/funeconomy/lootbox');
const Crate = require('../../models/funeconomy/crate');
const data = require('./questData');

const DAY_MS = 24 * 60 * 60 * 1000;
const OFFSET_MS = cfg.TIMEZONE_OFFSET_HOURS * 60 * 60 * 1000;
const DUPLICATE_KEY = 11000;

const dayNumber = (now = Date.now()) => Math.floor((now + OFFSET_MS) / DAY_MS);
// Minggu dimulai hari Senin (hari ke-0 epoch = Kamis).
const weekNumber = (now = Date.now()) => Math.floor((dayNumber(now) + 3) / 7);
const dayResetAt = (now = Date.now()) => (dayNumber(now) + 1) * DAY_MS - OFFSET_MS;
const weekResetAt = (now = Date.now()) => ((weekNumber(now) + 1) * 7 - 3) * DAY_MS - OFFSET_MS;

const tasksOf = (kind) => (kind === 'weekly' ? data.WEEKLY_TASKS : data.DAILY_TASKS);
const rewardOf = (kind) => (kind === 'weekly' ? data.WEEKLY_REWARD : data.DAILY_REWARD);

async function ensure(userId) {
    await Quest.updateOne({ userId }, { $setOnInsert: { userId } }, { upsert: true })
        .catch((error) => { if (error?.code !== DUPLICATE_KEY) throw error; });
}

/** Reset progres kalau hari/minggu sudah berganti (atomik: hanya satu proses yang berhasil mereset). */
async function rollover(userId, now = Date.now()) {
    await ensure(userId);
    await Quest.updateOne({ userId, dailyDay: { $ne: dayNumber(now) } },
        { $set: { dailyDay: dayNumber(now), daily: {}, dailyClaimed: false } });
    await Quest.updateOne({ userId, weeklyWeek: { $ne: weekNumber(now) } },
        { $set: { weeklyWeek: weekNumber(now), weekly: {}, weeklyClaimed: false } });
}

/* ---------- quest acak ---------- */

function randomQuest(random = Math.random) {
    const names = Object.keys(data.QUESTS);
    const name = names[Math.floor(random() * names.length)];
    const { chance } = data.QUESTS[name];
    let roll = random();
    let level = chance.length - 1;
    for (let i = 0; i < chance.length; i++) {
        if (roll <= chance[i]) { level = i; break; }
        roll -= chance[i];
    }
    const prizes = ['cash', 'shards', 'lootbox', 'crate'];
    const prize = prizes[Math.floor(random() * prizes.length)];
    return { qid: Math.floor(random() * 1e9), name, level, prize, count: 0, locked: false, done: false };
}

/* ---------- hadiah ---------- */

/** Berikan hadiah { cash, lootbox, crate, shards }. */
async function grant(userId, reward) {
    if (reward.cash) await Economy.add(userId, reward.cash);
    if (reward.lootbox) await Lootbox.updateOne({ userId }, { $inc: { boxcount: reward.lootbox } }, { upsert: true, setDefaultsOnInsert: true });
    if (reward.crate) await Crate.updateOne({ userId }, { $inc: { boxcount: reward.crate } }, { upsert: true, setDefaultsOnInsert: true });
    if (reward.shards) await Crate.updateOne({ userId }, { $inc: { shards: reward.shards } }, { upsert: true, setDefaultsOnInsert: true });
}

const questPrize = (quest) => ({ [quest.prize]: data.questReward(quest.name, quest.level, quest.prize) });

/* ---------- progres ---------- */

/**
 * Catat progres. key: daily, quest, hunt, battle, lootbox, crate, gamble, pray, atau find (extra.ranks = [{rank, count}]).
 * Tidak pernah melempar error. Return daftar quest yang baru selesai.
 */
async function track(userId, key, { count = 1, now = Date.now(), ranks } = {}) {
    try {
        userId = String(userId);
        const inc = {};
        if (data.DAILY_TASKS.some((t) => t.key === key)) inc[`daily.${key}`] = count;
        if (data.WEEKLY_TASKS.some((t) => t.key === key)) inc[`weekly.${key}`] = count;

        if (Object.keys(inc).length) {
            const fast = { userId, dailyDay: dayNumber(now), weeklyWeek: weekNumber(now) };
            let result = await Quest.updateOne(fast, { $inc: inc });
            if (!(result.matchedCount ?? result.n)) {
                await rollover(userId, now);
                await Quest.updateOne(fast, { $inc: inc });
            }
        }
        return await trackQuests(userId, key, count, ranks);
    } catch (error) {
        console.error('[FUNECONOMY] quest track failed:', error.message);
        return [];
    }
}

async function trackQuests(userId, key, count, ranks) {
    if (!data.QUESTS[key]) return [];
    const doc = await Quest.findOne({ userId }).lean();
    const finished = [];
    for (const quest of doc?.quests || []) {
        if (quest.name !== key || quest.done) continue;
        let add = count;
        if (key === 'find') {
            const rank = data.QUESTS.find.count[quest.level];
            add = (ranks || []).filter((r) => r.rank === rank).reduce((sum, r) => sum + r.count, 0);
        }
        if (add <= 0) continue;
        await Quest.updateOne({ userId, quests: { $elemMatch: { qid: quest.qid, done: false } } }, { $inc: { 'quests.$.count': add } });
        const goal = data.questGoal(quest.name, quest.level);
        const marked = await Quest.updateOne(
            { userId, quests: { $elemMatch: { qid: quest.qid, done: false, count: { $gte: goal } } } },
            { $set: { 'quests.$.done': true } }
        );
        if (marked.modifiedCount ?? marked.nModified) finished.push(quest);
    }
    return finished;
}

/* ---------- membaca keadaan ---------- */

/**
 * Keadaan lengkap user: progres hari ini/minggu ini dan daftar quest. Sekalian mereset hari/minggu baru
 * dan memberi quest harian (1 per hari sampai 3; pengguna baru langsung dapat 2).
 */
async function getState(userId, { now = Date.now(), random = Math.random } = {}) {
    userId = String(userId);
    await rollover(userId, now);
    const today = dayNumber(now);
    const first = await Quest.findOneAndUpdate(
        { userId, questDay: -1, 'quests.0': { $exists: false } },
        { $set: { questDay: today }, $push: { quests: { $each: [randomQuest(random), randomQuest(random)] } } }
    ).lean();
    if (!first) {
        await Quest.findOneAndUpdate(
            { userId, questDay: { $lt: today }, 'quests.2': { $exists: false } },
            { $set: { questDay: today }, $push: { quests: randomQuest(random) } }
        );
    }
    const doc = await Quest.findOne({ userId }).lean();
    return {
        daily: doc.daily || {}, dailyClaimed: !!doc.dailyClaimed,
        weekly: doc.weekly || {}, weeklyClaimed: !!doc.weeklyClaimed,
        quests: doc.quests || [], canReroll: doc.rerollDay < today,
        dailyResetAt: dayResetAt(now), weeklyResetAt: weekResetAt(now), questResetAt: dayResetAt(now)
    };
}

/** Jumlah task yang sudah selesai dan apakah semuanya selesai. */
function checklistStatus(kind, progress) {
    const tasks = tasksOf(kind);
    const done = tasks.filter((t) => (progress[t.key] || 0) >= t.goal).length;
    return { done, total: tasks.length, complete: done === tasks.length };
}

/* ---------- klaim ---------- */

/** Ambil hadiah checklist. Return { ok, reward } atau { ok:false, error:'incomplete'|'claimed' }. */
async function claimChecklist(userId, kind, { now = Date.now() } = {}) {
    userId = String(userId);
    await rollover(userId, now);
    const field = kind === 'weekly' ? 'weekly' : 'daily';
    const filter = kind === 'weekly'
        ? { userId, weeklyWeek: weekNumber(now), weeklyClaimed: false }
        : { userId, dailyDay: dayNumber(now), dailyClaimed: false };
    for (const task of tasksOf(kind)) filter[`${field}.${task.key}`] = { $gte: task.goal };
    const claimedField = kind === 'weekly' ? 'weeklyClaimed' : 'dailyClaimed';

    const updated = await Quest.findOneAndUpdate(filter, { $set: { [claimedField]: true } }).lean();
    if (!updated) {
        const doc = await Quest.findOne({ userId }).lean();
        return { ok: false, error: doc?.[claimedField] ? 'claimed' : 'incomplete' };
    }
    const reward = rewardOf(kind);
    try {
        await grant(userId, reward);
    } catch (error) {
        await Quest.updateOne({ userId }, { $set: { [claimedField]: false } });
        throw error;
    }
    return { ok: true, reward };
}

/** Ambil hadiah semua quest yang sudah selesai. Return { ok, count, reward } atau { ok:false }. */
async function claimQuests(userId, { now = Date.now() } = {}) {
    userId = String(userId);
    await ensure(userId);
    const before = await Quest.findOneAndUpdate(
        { userId, 'quests.done': true },
        { $pull: { quests: { done: true } } }
    ).lean();
    const done = (before?.quests || []).filter((q) => q.done);
    if (!done.length) return { ok: false };
    const total = { cash: 0, lootbox: 0, crate: 0, shards: 0 };
    for (const quest of done) for (const [kind, amount] of Object.entries(questPrize(quest))) total[kind] += amount;
    await grant(userId, total);
    await track(userId, 'quest', { count: done.length, now });
    return { ok: true, count: done.length, reward: total };
}

/** Kunci/buka kunci satu quest (quest terkunci tidak ikut di-reroll). */
async function setLocked(userId, qid, locked) {
    const result = await Quest.updateOne({ userId: String(userId), 'quests.qid': qid }, { $set: { 'quests.$.locked': !!locked } });
    return !!(result.matchedCount ?? result.n);
}

/** Reroll semua quest yang belum selesai dan tidak terkunci, sekali per hari. */
async function reroll(userId, { now = Date.now(), random = Math.random } = {}) {
    userId = String(userId);
    await ensure(userId);
    const claimed = await Quest.findOneAndUpdate(
        { userId, rerollDay: { $lt: dayNumber(now) } }, { $set: { rerollDay: dayNumber(now) } }
    ).lean();
    if (!claimed) return { ok: false, error: 'used' };
    const quests = claimed.quests.map((q) => (q.locked || q.done ? q : randomQuest(random)));
    if (!quests.some((q, i) => q !== claimed.quests[i])) {
        // Tidak ada yang bisa diganti: kembalikan jatah reroll.
        await Quest.updateOne({ userId }, { $set: { rerollDay: claimed.rerollDay } });
        return { ok: false, error: 'none' };
    }
    await Quest.updateOne({ userId }, { $set: { quests } });
    return { ok: true };
}

module.exports = {
    dayNumber, weekNumber, dayResetAt, weekResetAt, randomQuest, grant, track, getState, checklistStatus,
    claimChecklist, claimQuests, setLocked, reroll, tasksOf, rewardOf
};
