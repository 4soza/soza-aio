// Autoplay disimpan per orang (userId), bukan per server.
// Saat antrean habis, yang dicek adalah pengaturan orang yang meminta lagu terakhir.
// Dokumen lama per server ({ guildId }) tetap dipakai sebagai cadangan untuk orang yang belum pernah mengatur.

function getCollection() {
    return require('../mongodb').autoplayCollection;
}

/** Ambil pengaturan autoplay seseorang: true / false, atau null kalau belum pernah diatur. */
async function getUserAutoplay(userId, collection = getCollection()) {
    if (!userId) return null;
    const doc = await collection.findOne({ userId: String(userId) });
    return doc && typeof doc.autoplay === 'boolean' ? doc.autoplay : null;
}

async function setUserAutoplay(userId, enabled, collection = getCollection()) {
    await collection.updateOne(
        { userId: String(userId) },
        { $set: { autoplay: Boolean(enabled), updatedAt: new Date() } },
        { upsert: true }
    );
    return Boolean(enabled);
}

/** Command pertama = aktif, command lagi = nonaktif. Mengembalikan status baru. */
async function toggleUserAutoplay(userId, collection = getCollection()) {
    const current = (await getUserAutoplay(userId, collection)) === true;
    return setUserAutoplay(userId, !current, collection);
}

/** id peminta sebuah lagu Riffy (track.requester atau track.info.requester). */
function getRequesterId(track) {
    const id = track?.requester?.id ?? track?.info?.requester?.id;
    return id ? String(id) : null;
}

/**
 * Apakah autoplay harus jalan saat antrean player habis?
 * Pengaturan peminta lagu terakhir menang; kalau belum pernah diatur, pakai pengaturan server lama.
 */
async function isAutoplayEnabledFor(player, guildId, collection = getCollection()) {
    const userId = getRequesterId(player.previous || player.current) || player.__autoplayUserId || null;
    if (userId) player.__autoplayUserId = userId;

    const own = await getUserAutoplay(userId, collection);
    if (own !== null) return own;

    const legacy = await collection.findOne({ guildId });
    return Boolean(legacy && legacy.autoplay);
}

module.exports = { getUserAutoplay, setUserAutoplay, toggleUserAutoplay, getRequesterId, isAutoplayEnabledFor };
