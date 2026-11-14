const cfg = require('../config');
const Economy = require('../../models/funeconomy/economy');
const cooldown = require('../cooldown');
const { rewardDaily } = require('../levelUp');
const emojis = require('../customEmoji');
const Lootbox = require('../../models/funeconomy/lootbox');
const Crate = require('../../models/funeconomy/crate');
const { trackFor } = require('../quests/questTrack');
const { fmt, displayName, send, errorLine, formatDuration, onCooldown } = require('../utils');

const DAY_MS = 24 * 60 * 60 * 1000;
const OFFSET_MS = cfg.TIMEZONE_OFFSET_HOURS * 60 * 60 * 1000;

const dayNumber = (now = Date.now()) => Math.floor((now + OFFSET_MS) / DAY_MS);
const msUntilReset = (now = Date.now()) => (dayNumber(now) + 1) * DAY_MS - OFFSET_MS - now;

const amountForStreak = (streak) =>
    cfg.DAILY.BASE + cfg.DAILY.PER_STREAK * (Math.min(streak, cfg.DAILY.MAX_STREAK_BONUS_DAYS + 1) - 1);

/**
 * Hadiah box daily: bergantian per 2 daily berturut-turut (streak 1-2 lootbox, 3-4 crate, 5-6 lootbox, dst).
 */
const boxForStreak = (streak) => (Math.floor((Math.max(1, streak) - 1) / 2) % 2 === 0 ? 'lootbox' : 'crate');

module.exports = {
    name: 'daily',
    aliases: [],
    async execute(message) {
        const userId = message.author.id;
        if (onCooldown(message, 'daily')) return;

        const name = displayName(message);
        const now = Date.now();
        const result = await Economy.claimDaily(userId, dayNumber(now), amountForStreak);
        cooldown.start('daily', userId);

        if (!result.claimed) {
            return send(
                message,
                `${cfg.EMOJI.TIMER} | **${name}**, Nu! You need to wait **${formatDuration(msUntilReset(now))}** for your next daily!`
            );
        }

        const box = boxForStreak(result.streak);
        const boxGranted = await (box === 'lootbox' ? Lootbox : Crate)
            .updateOne({ userId }, { $inc: { boxcount: 1 } }, { upsert: true, setDefaultsOnInsert: true })
            .then(() => true, (error) => { console.error('[FUNECONOMY] daily box failed:', error.message); return false; });

        const sent = await send(message, [
            `${cfg.EMOJI.DAILY} | **${name}**, Here is your daily **${cfg.CASH_EMOJI} ${fmt(result.amount)} ${cfg.CASH_NAME}**!`,
            `${cfg.EMOJI.DAILY} | You're on a **${fmt(result.streak)}** daily streak!`,
            ...(boxGranted ? [`${box === 'lootbox' ? emojis.lootbox() : emojis.crate()} | You received a **${box}**!`] : []),
            `${cfg.EMOJI.TIMER} | Your next daily is in: ${formatDuration(msUntilReset(now))}`
        ].join('\n'));

        trackFor(message, 'daily');

        // Bonus XP dari daily; level up diumumkan terpisah setelah pesan daily.
        await rewardDaily({
            userId, channel: message.channel, name, guildId: message.guild?.id,
            avatarURL: message.author.displayAvatarURL?.({ extension: 'png', size: 256 }) ?? null
        });
        return sent;
    },
    _internals: { dayNumber, msUntilReset, amountForStreak, boxForStreak }
};
