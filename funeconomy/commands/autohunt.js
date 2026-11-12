// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
const cfg = require('../config');
const Economy = require('../../models/funeconomy/economy');
const cooldown = require('../cooldown');
const { fmt, displayName, send, sendEmbed, canEmbed, sendTemporaryError, onCooldown } = require('../utils');
const { RANKS, RANK_ORDER } = require('../zoo/data');
const { addAnimals } = require('../zoo/zooDb');
const { huntMany } = require('../zoo/hunting');
const HuntBot = require('../zoo/huntbot');
const { bar, toSmallNum, BLANK } = require('../zoo/format');
const teamUtil = require('../battle/teamUtil');
const { EMBED_COLOR } = require('../battle/battleDisplay');

const BOT = '🤖';
const ESSENCE = '✨';
const ROBOT_IMAGE = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/72x72/1f916.png';
const err = (message, name, text) => sendTemporaryError(message, `**🚫 | ${name}**, ${text}`);

/** "10h" / "30m" / "1.5h" -> jam. Angka polos dianggap cash (return null). */
function parseHours(token) {
    const m = /^(\d+(?:\.\d+)?)(h|m|d|s)$/i.exec(String(token || ''));
    if (!m) return null;
    const n = parseFloat(m[1]);
    return { h: n, m: n / 60, d: n * 24, s: n / 3600 }[m[2].toLowerCase()];
}

const timeText = (mins) => `${mins >= 60 ? `${Math.trunc(mins / 60)}H ` : ''}${mins % 60}M`;

/** Selesaikan hunt bot yang sudah jadi: tambah hewan + XP, kirim hasil. Return progress kalau belum selesai. */
async function claimAndAnnounce(message, name) {
    const userId = message.author.id;
    const result = await HuntBot.claim(userId);
    if (!result) return null;
    if (result.progress) return result.progress;

    const { huntcount, totalGain, totalExp, radar } = result.claimed;
    const hunt = huntMany(huntcount, { huntbot: radar });
    const counts = {};
    for (const a of hunt.ordered) counts[a.key] = a.count;
    await addAnimals(userId, counts);
    try { await teamUtil.giveXpToUserTeams(userId, totalExp); } catch { /* tanpa team */ }

    const digits = Math.trunc(Math.log10(Math.max(1, ...hunt.ordered.map((a) => a.count))) + 1);
    let text = `**${BOT} |** \`BEEP BOOP. I AM BACK WITH ${huntcount} ANIMALS,\`\n${BLANK} **|** \`${totalGain} ESSENCE, AND ${totalExp} EXPERIENCE\``;
    for (const rankId of RANK_ORDER) {
        const row = hunt.ordered.filter((a) => a.rank === rankId);
        if (row.length) text += `\n${RANKS[rankId].emoji} **|** ${row.map((a) => `${a.uni}${toSmallNum(a.count, digits)}`).join('  ')}`;
    }
    await send(message, text);
    return 'claimed';
}

function progressText(progress) {
    const pct = bar(progress.timer, progress.huntmin, 25);
    return `**${BOT} |** \`BEEP BOOP. I AM STILL HUNTING. I WILL BE BACK IN ${timeText(progress.left)}\`\n`
        + `${BLANK} **|** \`${pct.percent}% DONE | ${progress.count} ANIMALS CAPTURED\`\n${BLANK} **|** ${pct.bar}`;
}

function traitLine(label, t) {
    const lv = t.max ? `\`Lvl ${t.lvl} [MAX]\`` : `\`Lvl ${t.lvl} [${t.currentxp}/${t.maxxp}]\``;
    return `${label} - \`${t.stat}${t.prefix}\`\n${lv} ${bar(t.max ? 1 : t.currentxp, t.max ? 1 : t.maxxp).bar}`;
}

async function display(message, name) {
    const progress = await claimAndAnnounce(message, name);
    if (progress === 'claimed') return null;
    const doc = await HuntBot.get(message.author.id);
    const t = HuntBot.readTraits(doc);
    const maxhunt = Math.floor(t.duration.stat * t.efficiency.stat);
    const body = [
        '`BEEP. BOOP. I AM HUNTBOT. I WILL HUNT FOR YOU MASTER.`',
        `Use \`${cfg.PREFIX}autohunt {cash}\` to get started (or a duration like \`${cfg.PREFIX}autohunt 10h\`).`,
        `Use \`${cfg.PREFIX}upgrade {trait} {count}\` to upgrade the traits below.`,
        `To obtain more essence, use \`${cfg.PREFIX}sacrifice {animal} {count}\`.`,
        '',
        traitLine('⏱ Efficiency', t.efficiency),
        traitLine('⏳ Duration', t.duration),
        traitLine(`${cfg.CASH_EMOJI} Cost`, t.cost),
        traitLine('🔧 Gain', t.gain),
        traitLine('⚔ Experience', t.exp),
        traitLine('📡 Radar', t.radar),
        '',
        `${ESSENCE} Animal Essence - \`${fmt(doc?.essence || 0)}\``,
        `\`Current Max Autohunt: ${fmt(maxhunt)} animals, ${fmt(Math.floor(t.gain.stat * t.duration.stat))} essence, and ${fmt(Math.floor(t.exp.stat * t.duration.stat))} xp for ${fmt(maxhunt * t.cost.stat)} cash\``
    ];
    if (progress) body.push('', `${BOT} **HUNTBOT is currently hunting!**`, progressText(progress));

    // Tampilan embed seperti OwO; kalau bot tidak boleh kirim embed, pakai teks biasa.
    if (!canEmbed(message)) return send(message, [`**${BOT} ${name}'s HuntBot**`, ...body].join('\n'));
    return sendEmbed(message, {
        color: EMBED_COLOR,
        author: { name: `${name}'s HuntBot`, icon_url: message.author.displayAvatarURL?.() },
        thumbnail: { url: ROBOT_IMAGE },
        description: body.join('\n').slice(0, 4096),
        footer: { text: `@${message.author.username}` }
    });
}

/** Hitung dan mulai hunt bot. Return { error } atau ringkasan. Dipisah supaya bisa diuji. */
async function startHunt(userId, token) {
    const doc = await HuntBot.get(userId);
    const t = HuntBot.readTraits(doc);
    const hours = parseHours(token);
    let cash;
    if (hours !== null) cash = Math.floor(t.efficiency.stat * t.cost.stat * hours);
    else if (/^\d+$/.test(token)) cash = parseInt(token, 10);
    else return { error: 'syntax' };
    if (hours !== null && !(hours > 0)) return { error: 'duration' };
    if (!(cash > 0)) return { error: 'amount' };

    const maxhunt = Math.floor(t.duration.stat * t.efficiency.stat);
    const maxgain = Math.floor(t.gain.stat * t.duration.stat);
    const maxexp = Math.floor(t.exp.stat * t.duration.stat);
    cash -= cash % t.cost.stat;
    if (cash > maxhunt * t.cost.stat) cash = maxhunt * t.cost.stat;
    const huntcount = Math.trunc(cash / t.cost.stat);
    if (!(huntcount > 0)) return { error: 'amount' };
    const huntmin = Math.ceil((huntcount / t.efficiency.stat) * 60);
    const percent = huntmin / (t.duration.stat * 60);

    const paid = await Economy.deduct(userId, cash);
    if (!paid) return { error: 'cash' };
    const started = await HuntBot.start(userId, huntcount, huntmin);
    if (!started) {
        await Economy.add(userId, cash);
        return { error: 'busy' };
    }
    return { cash, huntcount, huntmin, gain: Math.floor(percent * maxgain), exp: Math.floor(percent * maxexp) };
}

module.exports = {
    name: 'autohunt',
    aliases: ['huntbot', 'hb', 'ah'],
    async execute(message, args) {
        const userId = message.author.id;
        const name = displayName(message);
        if (onCooldown(message, 'autohunt')) return;
        cooldown.start('autohunt', userId);

        if (!args.length) return display(message, name);

        // Sedang berburu / sudah selesai: tampilkan progres atau hasil
        const progress = await claimAndAnnounce(message, name);
        if (progress === 'claimed') return null;
        if (progress) return send(message, progressText(progress));

        const result = await startHunt(userId, args[0].toLowerCase());
        if (result.error === 'syntax') return err(message, name, 'Wrong syntax!');
        if (result.error === 'duration') return err(message, name, 'Invalid duration!');
        if (result.error === 'amount') return err(message, name, `Invalid ${cfg.CASH_NAME} amount!`);
        if (result.error === 'cash') return err(message, name, `You don't have enough ${cfg.CASH_NAME}!`);
        if (result.error) return err(message, name, 'HuntBot is already hunting!');
        return send(message, `**${BOT} |** \`BEEP BOOP. \`**\`${name}\`**\`, YOU SPENT ${fmt(result.cash)} ${cfg.CASH_NAME}\`\n`
            + `${BLANK} **|** \`I WILL BE BACK IN ${timeText(result.huntmin)} WITH ${result.huntcount} ANIMALS,\`\n`
            + `${BLANK} **|** \`${result.gain} ESSENCE, AND ${result.exp} EXPERIENCE\``);
    },
    _internals: { parseHours, startHunt, claimAndAnnounce }
};
