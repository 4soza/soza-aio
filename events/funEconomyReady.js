const { startScheduler } = require('../funeconomy/lottery');
const { startSweeper } = require('../funeconomy/gameExpiry');
const customEmoji = require('../funeconomy/customEmoji');
const { migrateAnimals } = require('../funeconomy/zoo/migrateAnimals');
const highlow = require('../funeconomy/highlow');
const mines = require('../funeconomy/mines');

// Menjalankan undian lottery otomatis tiap pergantian hari, dan mengabu-abukan game HighLow/Mines yang sudah
// 10 menit tidak disentuh (juga yang kadaluarsa saat bot mati). Dimuat otomatis oleh handlers/events.js.
module.exports = {
    name: 'clientReady',
    once: true,
    async execute(client) {
        startScheduler(client);
        // Unggah emoji kustom (rarity, shard, crate, lootbox) lalu pakai; gagal = tetap emoji Unicode.
        customEmoji.sync(client).catch((error) => console.warn('[FUNECONOMY] Emoji sync failed:', error.message));
        migrateAnimals().catch((error) => console.warn('[FUNECONOMY] Migrasi hewan gagal:', error.message));
        startSweeper(client, [highlow.expireStaleGames, mines.expireStaleGames]);
    }
};
