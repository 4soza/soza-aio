/**
 * Pesan interaktif (shop, weapon, tantangan battle, lamaran, konfirmasi) jadi abu-abu dan tombolnya
 * dinonaktifkan kalau 10 menit tidak ada aktivitas, seperti HighLow dan Mines.
 * Timer ada di memori (hilang kalau bot restart) dan diulang setiap kali pesan dipakai.
 */
const { EXPIRE_MS, EXPIRED_COLOR } = require('./gameExpiry');

const timers = new Map(); // messageId -> timeout

const plain = (x) => (x && typeof x.toJSON === 'function' ? x.toJSON() : x);

const IS_COMPONENTS_V2 = 32768;
const INTERACTIVE = new Set([2, 3, 5, 6, 7, 8]); // button, select menus

/** Rekursif: semua tombol/select jadi nonaktif, container (Components V2) jadi abu-abu. */
function greyComponent(component) {
    const json = { ...plain(component) };
    if (INTERACTIVE.has(json.type)) json.disabled = true;
    if (json.type === 17) {
        json.accent_color = EXPIRED_COLOR;
        if ('accentColor' in json) json.accentColor = EXPIRED_COLOR;
    }
    if (Array.isArray(json.components)) json.components = json.components.map(greyComponent);
    if (json.accessory) json.accessory = greyComponent(json.accessory);
    return json;
}

/** Versi abu-abu dari pesan: warna embed abu-abu, semua tombol nonaktif. Return null kalau tidak ada yang perlu diubah. */
function greyedPayload(message) {
    const isV2 = message.flags && typeof message.flags.has === 'function' && message.flags.has(IS_COMPONENTS_V2);
    if (isV2) {
        const components = (message.components || []).map(greyComponent);
        if (!components.length) return null;
        return { components, flags: IS_COMPONENTS_V2, allowedMentions: { parse: [] } };
    }
    // Gambar yang dilampirkan dan dipakai embed (attachment://) harus tetap dirujuk lewat attachment://;
    // kalau tidak, Discord menampilkan lampiran itu lagi di luar embed (gambar jadi dobel).
    const attachments = [...(message.attachments?.values?.() || [])];
    const byUrl = (url) => attachments.find((a) => String(url || '').split('?')[0] === String(a.url || '').split('?')[0]);
    const embeds = (message.embeds || []).map((e) => {
        const json = { ...plain(e), color: EXPIRED_COLOR };
        const att = json.image?.url && byUrl(json.image.url);
        if (att) json.image = { url: `attachment://${att.name}` };
        return json;
    });
    const components = (message.components || []).map((row) => {
        const json = plain(row);
        return { ...json, components: (json.components || []).map((c) => ({ ...plain(c), disabled: true })) };
    });
    if (!embeds.length && !components.length) return null;
    const payload = { embeds, components, allowedMentions: { parse: [] } };
    // Hanya id + nama: lampiran yang sudah ada dipertahankan, tidak diunggah ulang.
    if (attachments.length) payload.attachments = attachments.map((a) => ({ id: a.id, filename: a.name }));
    return payload;
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

module.exports = { track, greyedPayload, greyComponent };
