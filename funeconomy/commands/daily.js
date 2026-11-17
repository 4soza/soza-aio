const cfg = require('../config');
const Economy = require('../../models/funeconomy/economy');
const cooldown = require('../cooldown');
const { rewardDaily } = require('../levelUp');
const emojis = require('../customEmoji');
const marriageDb = require('../shop/marriageDb');
const Lootbox = require('../../models/funeconomy/lootbox');
const Crate = require('../../models/funeconomy/crate');
const { trackFor } = require('../quests/questTrack');
const ringShop = require('../shop/ringShop');
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

const COUPLE_CASH = 5000;
/** Box bonus pasangan: bergantian per 2 daily bersama, mulai dari crate. */
const coupleBoxFor = (dailies) => (Math.floor((Math.max(1, dailies) - 1) / 2) % 2 === 0 ? 'crate' : 'lootbox');

async function partnerName(message, partnerId) {
    try {
        const user = await message.client.users.fetch(partnerId);
        if (user) return user.username;
    } catch { /* fallback */ }
    return `<@${partnerId}>`;
}

/** Bonus pasangan: hanya jika pasangan sudah claim hari ini (pemain kedua). Return baris pesan atau null. */
async function coupleBonus(message, userId, day) {
    try {
        const r = await marriageDb.recordDaily(userId, day);
        if (!r.together) return null;
        const box = coupleBoxFor(r.dailies);
        const Model = box === 'lootbox' ? Lootbox : Crate;
        for (const id of [userId, r.partner]) {
            await Economy.add(id, COUPLE_CASH);
            await Model.updateOne({ userId: id }, { $inc: { boxcount: 1 } }, { upsert: true, setDefaultsOnInsert: true });
        }
        const ring = ringShop.getRing(r.ring)?.emoji || '💍';
        const boxEmoji = box === 'lootbox' ? emojis.lootbox() : emojis.crate();
        const pn = await partnerName(message, r.partner);
        return `${ring} | You and **${pn}** received ${cfg.CASH_EMOJI} ${fmt(COUPLE_CASH)} ${cfg.CASH_NAME} and a ${boxEmoji} **${box}**!`;
    } catch (error) {
        console.error('[FUNECONOMY] marriage daily failed:', error.message);
        return null;
    }
}

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

        const coupleLine = await coupleBonus(message, userId, dayNumber(now));

        const sent = await send(message, [
            `${cfg.EMOJI.DAILY} | **${name}**, Here is your daily **${cfg.CASH_EMOJI} ${fmt(result.amount)} ${cfg.CASH_NAME}**!`,
            `${cfg.EMOJI.DAILY} | You're on a **${fmt(result.streak)}** daily streak!`,
            ...(boxGranted ? [`${box === 'lootbox' ? emojis.lootbox() : emojis.crate()} | You received a **${box}**!`] : []),
            ...(coupleLine ? [coupleLine] : []),
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
    _internals: { coupleBoxFor, dayNumber, msUntilReset, amountForStreak, boxForStreak }
};
