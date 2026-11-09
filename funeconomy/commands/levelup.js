const cfg = require('../config');

// Pesan level up diatur per channel lewat enable/disable (seperti OwO):
//   sdisable levelup  -> pesan level up tidak muncul di channel ini (XP dan hadiah tetap jalan)
//   senable levelup   -> munculkan lagi
// Command ini hanya menjelaskan caranya (kalau dimatikan, command ini ikut diblokir seperti command lain).
module.exports = {
    name: 'levelup',
    aliases: ['lvlup'],
    async execute(message) {
        const { send } = require('../utils');
        return send(message, `${cfg.EMOJI.LEVEL} | Level up messages are **enabled** in this channel. ` +
            `Use \`${cfg.PREFIX}disable levelup\` to turn them off for this channel.`);
    }
};
