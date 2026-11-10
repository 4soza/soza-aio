// Bantuan untuk serah-terima voice (s!join voice-only -> player Lavalink) di s!play.

/**
 * Tunggu sampai Discord benar-benar menganggap bot sudah keluar dari voice. Tanpa ini, pembaruan
 * "bot keluar voice" dari koneksi voice-only yang baru dilepas bisa tiba SETELAH Riffy membuat player,
 * lalu menghancurkan player baru itu, dan s!play gagal dengan "Cannot read properties of null (reading 'establishing')".
 */
async function waitForBotToLeaveVoice(guild, timeoutMs = 3000, intervalMs = 100) {
    const deadline = Date.now() + timeoutMs;
    while (guild?.members?.me?.voice?.channelId) {
        if (Date.now() > deadline) return false;
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    return true;
}

/**
 * Error dari keadaan player di sisi bot (player sudah dihancurkan / koneksi belum siap), bukan masalah node Lavalink.
 * Node tidak boleh ditandai "tidak sehat" karena error seperti ini.
 */
function isPlayerStateError(error) {
    const message = String(error?.message || error || '').toLowerCase();
    return message.includes("reading 'establishing'") ||
        message.includes('player connection is not initiated') ||
        message.includes('player is destroyed');
}

module.exports = { waitForBotToLeaveVoice, isPlayerStateError };
