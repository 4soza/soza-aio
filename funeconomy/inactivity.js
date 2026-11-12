/**
 * Pesan interaktif (shop, weapon, tantangan battle, lamaran, konfirmasi) jadi abu-abu dan tombolnya
 * dinonaktifkan kalau 10 menit tidak ada aktivitas, seperti HighLow dan Mines.
 * Timer ada di memori (hilang kalau bot restart) dan diulang setiap kali pesan dipakai.
 */
const { EXPIRE_MS, EXPIRED_COLOR } = require('./gameExpiry');

const timers = new Map(); // messageId -> timeout

const plain = (x) => (x && typeof x.toJSON === 'function' ? x.toJSON() : x);

/** Versi abu-abu dari pesan: warna embed abu-abu, semua tombol nonaktif. Return null kalau tidak ada yang perlu diubah. */
function greyedPayload(message) {
    const embeds = (message.embeds || []).map((e) => ({ ...plain(e), color: EXPIRED_COLOR }));
    const components = (message.components || []).map((row) => {
        const json = plain(row);
        return { ...json, components: (json.components || []).map((c) => ({ ...plain(c), disabled: true })) };
    });
    if (!embeds.length && !components.length) return null;
    return { embeds, components, allowedMentions: { parse: [] } };
}

async function expire(message) {
    timers.delete(message.id);
    try {
        const fresh = await message.channel.messages.fetch(message.id);
        const payload = greyedPayload(fresh);
        if (payload) await fresh.edit(payload);
    } catch { /* pesan sudah dihapus atau bot kehilangan akses */ }
}

/** Mulai atau ulang hitungan 10 menit untuk pesan ini. Return pesan yang sama supaya bisa dipakai langsung. */
function track(message) {
    if (!message?.id || !message.channel?.messages?.fetch) return message;
    clearTimeout(timers.get(message.id));
    const timer = setTimeout(() => expire(message), EXPIRE_MS);
    timer.unref?.();
    timers.set(message.id, timer);
    return message;
}

module.exports = { track, greyedPayload };
