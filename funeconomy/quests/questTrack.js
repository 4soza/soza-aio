const cfg = require('../config');
const db = require('./questDb');
const cooldown = require('../cooldown');
const { displayName } = require('../utils');

/**
 * Catat progres task/quest untuk pengirim pesan lalu beri tahu kalau ada quest yang baru selesai.
 * Tidak pernah melempar error dan tidak perlu di-await.
 */
async function trackFor(message, key, options = {}) {
    try {
        const finished = await db.track(message.author.id, key, options);
        if (finished.length) {
            await message.channel.send({
                content: `📜 | **${displayName(message)}**, you finished ${finished.length > 1 ? `${finished.length} quests` : 'a quest'}! Use \`${cfg.PREFIX}quest\` to claim your reward.`,
                allowedMentions: { parse: [] }
            });
        }
    } catch (error) {
        console.error('[FUNECONOMY] quest notify failed:', error.message);
    }
}

// Game taruhan: cooldown dimulai hanya setelah taruhan diterima, jadi itu saat yang tepat menghitung "gamble".
const GAMBLE_GAMES = new Set(['slots', 'cf', 'bj', 'mines', 'hl', 'rl']);
cooldown.onStart((game, userId) => {
    if (GAMBLE_GAMES.has(game)) db.track(userId, 'gamble');
});

module.exports = { trackFor };
