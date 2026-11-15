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
function greyedPayload(message, nameOf = (a) => a.name) {
    const isV2 = message.flags && typeof message.flags.has === 'function' && message.flags.has(IS_COMPONENTS_V2);
    if (isV2) {
        const components = (message.components || []).map(greyComponent);
        if (!components.length) return null;
        return { components, flags: IS_COMPONENTS_V2, allowedMentions: { parse: [] } };
    }
    // Gambar yang dilampirkan dan dipakai embed (attachment://) harus tetap dirujuk lewat attachment://;
    // kalau tidak, Discord menampilkan lampiran itu lagi di luar embed (gambar jadi dobel).
    const attachments = [...(message.attachments?.values?.() || [])];
    // Cocokkan lewat nama file (host bisa beda: cdn / media proxy), bukan seluruh URL.
    const base = (url) => decodeURIComponent(String(url || '').split('?')[0].split('/').pop() || '');
    const byUrl = (url) => attachments.find((a) => base(url) === a.name || base(url) === base(a.url));
    const embeds = (message.embeds || []).map((e) => {
        const json = { ...plain(e), color: EXPIRED_COLOR };
        for (const key of ['image', 'thumbnail']) {
            const att = json[key]?.url && byUrl(json[key].url);
            if (att) json[key] = { url: `attachment://${nameOf(att)}` };
        }
        return json;
    });
    const components = (message.components || []).map((row) => {
        const json = plain(row);
        return { ...json, components: (json.components || []).map((c) => ({ ...plain(c), disabled: true })) };
    });
    if (!embeds.length && !components.length) return null;
    const payload = { embeds, components, allowedMentions: { parse: [] } };
    // Hanya id + nama: lampiran yang sudah ada dipertahankan, tidak diunggah ulang.
    if (attachments.length) payload.attachments = attachments.map((a) => ({ id: a.id, filename: nameOf(a) }));
    return payload;
}

/*
 * Edit yang hanya "merujuk" lampiran lama membuat Discord menampilkan lampiran itu lagi di luar embed (gambar dobel).
 * Jalur yang pasti benar adalah yang dipakai battle saat update turn: unggah file lagi + attachments: [].
 * Jadi gambar lama diunduh dari CDN lalu dipasang ulang; kalau gagal diunduh, pakai payload biasa.
 */
async function greyedPayloadWithFiles(message) {
    // Nama file baru (seperti update turn battle yang selalu ganti nama), supaya tidak bentrok dengan lampiran lama.
    const nameOf = (a) => String(a.name).replace(/(\.\w+)?$/, (ext) => `-g${ext}`);
    const payload = greyedPayload(message, nameOf);
    if (!payload?.attachments?.length) return payload;
    try {
        const list = [...message.attachments.values()];
        const files = await Promise.all(list.map(async (a) => {
            const res = await fetch(a.url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return { attachment: Buffer.from(await res.arrayBuffer()), name: nameOf(a) };
        }));
        return { ...payload, files, attachments: [] };
    } catch {
        return greyedPayload(message); // gagal unduh: pertahankan lampiran lama dengan nama aslinya
    }
}

async function expire(message) {
    timers.delete(message.id);
    try {
        const fresh = await message.channel.messages.fetch(message.id);
        const payload = await greyedPayloadWithFiles(fresh);
        if (payload) await fresh.edit(payload);
    } catch (error) {
        // pesan sudah dihapus atau bot kehilangan akses
        console.warn(`[INACTIVITY] Gagal membuat pesan abu-abu: ${error.message}`);
    }
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

module.exports = { track, greyedPayload, greyedPayloadWithFiles, greyComponent };
