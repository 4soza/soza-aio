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
function readHuntData(userId) {
    return Promise.all([
        Gems.getActiveGems(userId),
        Promise.resolve().then(() => teamUtil.getActiveTeamPets(userId)).catch(() => []) // tanpa team
    ]);
}

async function performHunt(userId, { rng = Math.random, now = Date.now(), preread, defer = false } = {}) {
    // Baca gem aktif dan pet team bersamaan (bisa sudah dibaca lebih awal, bersamaan dengan potong cash)
    const [active, pets] = await (preread || readHuntData(userId));
    const teamPets = Array.isArray(pets) ? pets : [];
    const { count, opts } = Gems.huntEffects(active);
    const hunt = huntMany(count, opts, rng);

    const counts = {};
    for (const a of hunt.ordered) counts[a.key] = a.count;

    // Semua tulis ke database bersamaan. Hewan wajib tersimpan (error = refund); sisanya hanya dicatat.
    const saved = addAnimals(userId, counts);
    const rest = Promise.all([
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
    const remaining = Gems.remainingAfterHunt(active, count);
    const base = { hunt, count, active, remaining, teamPets, now };
    if (defer) {
        // Pesan boleh dikirim sekarang; `writes` selesai saat database sudah tersimpan semua.
        return { ...base, lootbox: { claimed: false, count: 0 }, writes: Promise.all([saved, rest]).then(([, [, , lootbox]]) => lootbox) };
    }
    const [, [, , lootbox]] = await Promise.all([saved, rest]);
    return { ...base, lootbox };
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

        // Potong cash dan baca data hunt bersamaan (satu putaran database, bukan dua)
        const preread = readHuntData(userId);
        preread.catch(() => {});
        const paid = await Economy.deduct(userId, HUNT_COST);
        if (!paid) return sendTemporaryError(message, errorLine(name, `you don't have enough ${cfg.CASH_NAME}!`));

        let result;
        try {
            result = await performHunt(userId, { preread, defer: true });
        } catch (error) {
            console.error('[FUNECONOMY] hunt failed:', error.message);
            await Economy.add(userId, HUNT_COST).catch(() => {});
            return sendTemporaryError(message, errorLine(name, 'something went wrong while hunting, you were refunded!'));
        }
        // Kirim hasil sekarang; penyimpanan ke database selesai di belakang.
        const writes = result.writes;
        writes.catch(() => {});
        const sent = await send(message, buildText(name, result));
        writes.then(async (lootbox) => {
            if (!lootbox?.claimed) return;
            result.lootbox = lootbox;
            trackFor(message, 'lootbox');
            await sent.edit({ content: buildText(name, result), allowedMentions: { parse: [] } }).catch(() => {});
        }, async (error) => {
            console.error('[FUNECONOMY] hunt save failed:', error.message);
            await Economy.add(userId, HUNT_COST).catch(() => {});
            await sendTemporaryError(message, errorLine(name, 'something went wrong while saving your hunt, you were refunded!')).catch(() => {});
        });
        // Task & quest: hunt, lootbox yang ditemukan, dan rank hewan (quest "find")
        trackFor(message, 'hunt', { ranks: (result.hunt.ordered || []).map((a) => ({ rank: a.rank, count: a.count })) });
        return sent;
    },
    _internals: { performHunt, buildText }
};
            
