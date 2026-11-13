/*
 * Task harian/mingguan dan quest, mengikuti tampilan "checklist" OwO.
 * Quest memakai angka dari OwO (data/quests.json, CC BY-NC-SA 4.0), disesuaikan dengan fitur bot ini.
 */

// Task harian: semua harus selesai untuk mengambil hadiah harian.
const DAILY_TASKS = [
    { key: 'daily', emoji: '🌅', label: 'Claim your daily', goal: 1 },
    { key: 'quest', emoji: '📜', label: 'Claim a quest', goal: 1 },
    { key: 'hunt', emoji: '🌱', label: 'Hunt 10 times', goal: 10 },
    { key: 'battle', emoji: '⚔️', label: 'Battle 10 times', goal: 10 },
    { key: 'lootbox', emoji: '📦', label: 'Find 3 Lootboxes', goal: 3 },
    { key: 'crate', emoji: '🧰', label: 'Find 3 Weapon Crates', goal: 3 }
];
const WEEKLY_TASKS = [
    { key: 'hunt', emoji: '🌱', label: 'Hunt 100 times', goal: 100 },
    { key: 'battle', emoji: '⚔️', label: 'Battle 100 times', goal: 100 },
    { key: 'daily', emoji: '🌅', label: 'Claim 5 dailies', goal: 5 },
    { key: 'gamble', emoji: '🎰', label: 'Gamble 50 times', goal: 50 },
    { key: 'quest', emoji: '📜', label: 'Claim 5 quests', goal: 5 }
];

// Hadiah checklist (weapon shard ikut di dalamnya).
const DAILY_REWARD = { cash: 1000, lootbox: 1, crate: 1, shards: 100 };
const WEEKLY_REWARD = { cash: 10000, lootbox: 3, crate: 3, shards: 500 };

const MAX_QUESTS = 3;

// Daftar quest: count/chance per level, hadiah per jenis (cash, lootbox, crate, shards).
const QUESTS = {
    hunt: {
        emoji: '🌱', text: (n) => `Hunt ${n} times!`,
        count: [10, 50, 100, 500, 1000], cash: [100, 500, 1000, 20000, 50000],
        lootbox: [1, 2, 3, 7, 10], crate: [1, 2, 3, 7, 10], shards: [100, 200, 300, 700, 1000],
        chance: [0.4, 0.3, 0.24, 0.05, 0.01]
    },
    battle: {
        emoji: '⚔️', text: (n) => `Battle ${n} times!`,
        count: [10, 50, 100, 500, 1000], cash: [100, 500, 1000, 20000, 50000],
        lootbox: [1, 2, 3, 7, 10], crate: [1, 2, 3, 7, 10], shards: [100, 200, 300, 700, 1000],
        chance: [0.4, 0.3, 0.24, 0.05, 0.01]
    },
    gamble: {
        emoji: '🎰', text: (n) => `Gamble ${n} times!`,
        count: [5, 10, 25], cash: [250, 750, 1000],
        lootbox: [1, 2, 3], crate: [1, 2, 3], shards: [100, 200, 300],
        chance: [0.4, 0.4, 0.2]
    },
    pray: {
        emoji: '🙏', text: (n) => `Pray ${n} times!`,
        count: [3, 5, 15], cash: [500, 2500, 20000],
        lootbox: [2, 4, 6], crate: [2, 4, 6], shards: [200, 400, 600],
        chance: [0.5, 0.3, 0.2]
    },
    // Berburu 3 hewan dengan rank tertentu; count[] berisi nama rank.
    find: {
        emoji: '🔎', text: (rank) => `Hunt 3 animals that are ${rank} rank!`, target: 3,
        count: ['rare', 'epic', 'mythical'], cash: [500, 2500, 20000],
        lootbox: [2, 5, 8], crate: [2, 5, 8], shards: [200, 500, 800],
        chance: [0.5, 0.3, 0.2]
    }
};

/** Target quest (angka). Untuk quest "find" target selalu 3. */
const questGoal = (name, level) => QUESTS[name].target ?? QUESTS[name].count[level];
/** Jumlah hadiah quest sesuai jenisnya. */
const questReward = (name, level, prize) => QUESTS[name][prize][level];

module.exports = {
    DAILY_TASKS, WEEKLY_TASKS, DAILY_REWARD, WEEKLY_REWARD, MAX_QUESTS, QUESTS, questGoal, questReward
};
