// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
const emojis = require('../customEmoji');
const cfg = require('../config');
const Economy = require('../../models/funeconomy/economy');
const cooldown = require('../cooldown');
const { displayName, send, sendTemporaryError, errorLine, onCooldown } = require('../utils');
const { RANKS } = require('../zoo/data');
const { addAnimals } = require('../zoo/zooDb');
const { HUNT_COST, huntMany } = require('../zoo/hunting');
const Gems = require('../zoo/gems');
const LootboxDb = require('../zoo/lootboxDb');
const { msUntilReset, hms, article, BLANK } = require('../zoo/format');
const teamUtil = require('../battle/teamUtil');
const { trackFor } = require('../quests/questTrack');

/** Lakukan satu hunt (setelah biaya dibayar). Dipisah dari command supaya bisa diuji. */
async function performHunt(userId, { rng = Math.random, now = Date.now() } = {}) {
    // Ronde 1: baca gem aktif dan pet team bersamaan
    const [active, pets] = await Promise.all([
        Gems.getActiveGems(userId),
        Promise.resolve().then(() => teamUtil.getActiveTeamPets(userId)).catch(() => []) // tanpa team
    ]);
    const teamPets = Array.isArray(pets) ? pets : [];
    const { count, opts } = Gems.huntEffects(active);
    const hunt = huntMany(count, opts, rng);

    const counts = {};
    for (const a of hunt.ordered) counts[a.key] = a.count;

    // Ronde 2: semua tulis ke database bersamaan
    const [, remaining, , lootbox] = await Promise.all([
        addAnimals(userId, counts),
        Gems.consumeHunt(userId, active, count),
        teamPets.length
            ? Promise.resolve().then(() => teamUtil.giveXpToUserTeams(userId, hunt.xp)).catch((error) => {
                console.error('[FUNECONOMY] hunt team xp failed:', error.message);
            })
            : null,
        Promise.resolve().then(() => LootboxDb.claimFromHunt(userId, { now, rng })).catch((error) => {
            console.error('[FUNECONOMY] hunt lootbox failed:', error.message);
            return { claimed: false, count: 0 };
        })
    ]);
    return { hunt, count, active, remaining, teamPets, lootbox };
}

function buildText(name, result, now = Date.now()) {
    const { hunt, active, remaining, teamPets, lootbox } = result;
    const first = hunt.ordered[0];
    let text;
    if (Object.keys(active).length) {
        const gemText = Object.entries(remaining)
            .map(([, r]) => `${r.gem.emoji}\`[${r.left}/${r.gem.length}]\``).join(' ');
        const found = hunt.ordered.map((a) => Array(a.count).fill(a.uni).join(' ')).join(' ');
        text = `**🌱 | ${name}**, hunt is empowered by ${gemText} !\n${BLANK} **|** You found: ${found}`;
    } else {
        text = `**🌱 | ${name}** spent ${HUNT_COST} ${cfg.CASH_EMOJI} and caught ${article(first.rank)} **${first.rank}** ${RANKS[first.rank].emoji} ${first.uni}!`;
    }
    if (teamPets.length) {
        text += `\n${BLANK} **|** ${teamPets.map((p) => p.uni).join(' ')} gained **${hunt.xp}xp**!`;
    }
    if (lootbox.claimed) {
        text += `\n**${emojis.lootbox()} |** You found a **lootbox**! \`[${lootbox.count}/${LootboxDb.DAILY_LIMIT}] RESETS IN: ${hms(msUntilReset(now))}\``;
    }
    return text;
}

module.exports = {
    name: 'hunt',
    aliases: ['h', 'catch'],
    async execute(message) {
        const userId = message.author.id;
        const name = displayName(message);
        if (onCooldown(message, 'hunt')) return;
        cooldown.start('hunt', userId);

        const paid = await Economy.deduct(userId, HUNT_COST);
        if (!paid) return sendTemporaryError(message, errorLine(name, `you don't have enough ${cfg.CASH_NAME}!`));

        let result;
        try {
            result = await performHunt(userId);
        } catch (error) {
            console.error('[FUNECONOMY] hunt failed:', error.message);
            await Economy.add(userId, HUNT_COST).catch(() => {});
            return sendTemporaryError(message, errorLine(name, 'something went wrong while hunting, you were refunded!'));
        }
        const sent = await send(message, buildText(name, result));
        // Task & quest: hunt, lootbox yang ditemukan, dan rank hewan (quest "find")
        trackFor(message, 'hunt', { ranks: (result.hunt.ordered || []).map((a) => ({ rank: a.rank, count: a.count })) });
        if (result.lootbox?.claimed) trackFor(message, 'lootbox');
        return sent;
    },
    _internals: { performHunt, buildText }
};
