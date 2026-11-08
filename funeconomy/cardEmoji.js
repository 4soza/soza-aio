// Emoji kartu (Application Emojis bot). Dipakai Blackjack dan HighLow.
// Nama emoji: card_As (statis), card_As_flip (animasi flip sekali putar), card_back (punggung kartu).
// Kalau emojinya belum ada, pemanggil memakai teks biasa (hanya angka/huruf kartu).
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUIT_LETTERS = ['s', 'h', 'd', 'c']; // urutan sama dengan nomor kartu: sekop, hati, wajik, keriting
const REFRESH_MS = 30 * 60 * 1000;

let manager = null;
let loading = null;
let loadedAt = 0;

/** Muat emoji aplikasi bot. Aman dipanggil berulang; gagal = abaikan (kartu jatuh ke teks). */
function ensureLoaded(client) {
    const emojis = client?.application?.emojis;
    if (!emojis) return Promise.resolve();
    manager = emojis;
    if (!loading || Date.now() - loadedAt > REFRESH_MS) {
        loadedAt = Date.now();
        loading = emojis.fetch().catch((error) => {
            loading = null;
            console.error('[FUNECONOMY] Card emoji load failed:', error.message);
        });
    }
    return loading;
}

// Dicari langsung di cache (sekitar 110 emoji), jadi emoji yang diganti lewat `suploadcards replace`
// langsung terpakai tanpa restart.
// Kalau ada beberapa emoji bernama sama (mis. sisa cache setelah `suploadcards replace`), pakai yang terbaru
// (ID snowflake terbesar), karena emoji lama sudah dihapus dan akan tampil sebagai teks :nama:.
function findEmoji(name) {
    if (!manager) return null;
    let best = null;
    for (const emoji of manager.cache.values()) {
        if (emoji.name !== name) continue;
        if (!best || BigInt(emoji.id) > BigInt(best.id)) best = emoji;
    }
    return best;
}

function lookup(name) {
    const emoji = findEmoji(name);
    return emoji ? `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>` : null;
}

/** Emoji kartu nomor 0-51, atau null kalau belum ada. `flip` = pakai versi animasi bila tersedia. */
function cardEmoji(n, { flip = false } = {}) {
    const base = `card_${RANKS[n % 13]}${SUIT_LETTERS[Math.floor(n / 13)]}`;
    return (flip && lookup(`${base}_flip`)) || lookup(base);
}

const backEmoji = () => lookup('card_back');

module.exports = { ensureLoaded, cardEmoji, backEmoji };
