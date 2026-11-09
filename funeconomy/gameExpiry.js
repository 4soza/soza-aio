// Kadaluarsa game (HighLow dan Mines), seperti OwO: kalau game tidak disentuh 10 menit, embed berubah abu-abu
// dan tombolnya mati. Game tetap tersimpan di database, jadi bisa dilanjutkan dengan mengetik ulang command-nya
// (pesan baru berstatus "resumed a ... game").
//
// Pengecekan dilakukan berkala terhadap database (bukan timer di memori), jadi tetap jalan setelah bot restart.
const cfg = require('./config');

const EXPIRE_MS = Number(cfg.GAME_EXPIRE_MS) > 0 ? Number(cfg.GAME_EXPIRE_MS) : 10 * 60 * 1000;
const EXPIRED_COLOR = 0x616063; // abu-abu seperti OwO
const SWEEP_MS = Math.min(30 * 1000, Math.max(1000, Math.floor(EXPIRE_MS / 2)));

/** Edit pesan berdasarkan id; mengembalikan false kalau pesannya sudah hilang atau tidak bisa diedit. */
async function editMessage(client, channelId, messageId, options) {
    if (!channelId || !messageId) return false;
    try {
        const channel = await client.channels.fetch(channelId);
        const message = await channel?.messages?.fetch(messageId);
        if (!message) return false;
        await message.edit(options);
        return true;
    } catch (error) {
        console.warn(`[FUNECONOMY] Could not edit message ${messageId}: ${error.message}`);
        return false;
    }
}

/** True kalau game terakhir disentuh lebih dari EXPIRE_MS yang lalu. */
function isIdle(game, now = Date.now()) {
    const touched = new Date(game.updatedAt).getTime();
    return Number.isFinite(touched) && now - touched >= EXPIRE_MS;
}

/** Filter database untuk game yang masih berjalan, sudah lewat batas waktu, dan pesannya belum diabu-abukan. */
function staleFilter(now = Date.now()) {
    return {
        status: 'playing',
        messageId: { $ne: null },
        updatedAt: { $lte: new Date(now - EXPIRE_MS) },
        $expr: { $ne: [{ $ifNull: ['$expiredMessageId', ''] }, '$messageId'] }
    };
}

// Game yang sudah selesai (kalah/cash out) juga kadaluarsa 10 menit setelah pesan terakhir diedit.
// Game selesai dihapus dari database, jadi hitungannya memakai timer di memori (seperti leaderboard).
const finishedTimers = new Map(); // messageId -> timeout

/** Jadwalkan pesan game yang sudah selesai agar jadi abu-abu 10 menit lagi. `buildExpired(game)` membuat isi pesannya. */
function scheduleFinished(client, game, buildExpired) {
    if (!game?.channelId || !game?.messageId) return;
    const key = game.messageId;
    clearTimeout(finishedTimers.get(key));
    const timer = setTimeout(() => {
        finishedTimers.delete(key);
        editMessage(client, game.channelId, game.messageId, buildExpired(game)).catch(() => {});
    }, EXPIRE_MS);
    timer.unref?.();
    finishedTimers.set(key, timer);
}

let sweeping = false;

/** Jalankan semua fungsi sweep sekarang, lalu berulang tiap SWEEP_MS. Dipanggil sekali saat bot siap. */
function startSweeper(client, sweeps) {
    const run = async () => {
        if (sweeping) return;
        sweeping = true;
        try {
            for (const sweep of sweeps) {
                await sweep(client).catch((error) => {
                    console.error('[FUNECONOMY] Game expiry sweep failed:', error.message);
                });
            }
        } finally {
            sweeping = false;
        }
    };
    run();
    const timer = setInterval(run, SWEEP_MS);
    timer.unref?.();
    return timer;
}

module.exports = { EXPIRE_MS, EXPIRED_COLOR, SWEEP_MS, editMessage, isIdle, staleFilter, scheduleFinished, startSweeper };
