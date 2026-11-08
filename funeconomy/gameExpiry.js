// Kadaluarsa game (HighLow dan Mines), seperti OwO: kalau game tidak disentuh 10 menit, embed berubah abu-abu
// dan tombolnya mati. Game tetap tersimpan di database, jadi bisa dilanjutkan dengan mengetik ulang command-nya
// (pesan baru berstatus "resumed a ... game").
const cfg = require('./config');

const EXPIRE_MS = Number(cfg.GAME_EXPIRE_MS) > 0 ? Number(cfg.GAME_EXPIRE_MS) : 10 * 60 * 1000;
const EXPIRED_COLOR = 0x616063; // abu-abu seperti OwO

const timers = new Map();

function cancel(key) {
    const timer = timers.get(key);
    if (timer) clearTimeout(timer);
    timers.delete(key);
}

/** Jadwalkan `task` setelah EXPIRE_MS. Memanggil lagi dengan key yang sama menggantikan jadwal sebelumnya. */
function schedule(key, task, ms = EXPIRE_MS) {
    cancel(key);
    const timer = setTimeout(() => {
        timers.delete(key);
        Promise.resolve().then(task).catch((error) => {
            console.error('[FUNECONOMY] Game expiry error:', error.message);
        });
    }, ms);
    timer.unref?.();
    timers.set(key, timer);
}

/** Edit pesan berdasarkan id; mengembalikan false kalau pesannya sudah hilang atau tidak bisa diedit. */
async function editMessage(client, channelId, messageId, options) {
    if (!channelId || !messageId) return false;
    try {
        const channel = await client.channels.fetch(channelId);
        const message = await channel?.messages?.fetch(messageId);
        if (!message) return false;
        await message.edit(options);
        return true;
    } catch {
        return false;
    }
}

module.exports = { EXPIRE_MS, EXPIRED_COLOR, schedule, cancel, editMessage };
