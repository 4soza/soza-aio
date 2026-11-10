const { EmbedBuilder } = require('discord.js');
const cfg = require('../config');
const Economy = require('../../models/funeconomy/economy');
const cooldown = require('../cooldown');
const { colorOf, parseTarget, payoutFor, spin } = require('../rouletteMath');
const {
    fmt, displayName, sleep, isAmountToken, send, sendTemporaryError, canEmbed, resolveBet, errorLine,
    acquireGambleLock, releaseGambleLock, onCooldown
} = require('../utils');

const COLORS = { spinning: 0x7ab8f5, win: 0x2ee820, lose: 0xe74c3c };
const TARGET_LABELS = {
    red: 'Red', black: 'Black', green: 'Green', odd: 'Odd', even: 'Even', low: 'Low (1-18)', high: 'High (19-36)'
};

const rl = () => cfg.ROULETTE || {};
const emoji = () => rl().EMOJI || {};
const ball = (number) => emoji()[colorOf(number)] || '⚪';
const usage = () => `\`${cfg.PREFIX}rl <amount|all> <red/black/green/odd/even/low/high/0-36>\``;

function targetLabel(target) {
    if (target.kind === 'number') return `${ball(target.number)} **${target.number}**`;
    const icon = emoji()[target.kind];
    return `${icon ? `${icon} ` : ''}**${TARGET_LABELS[target.kind]}**`;
}

function render({ name, avatar, bet, target, number, spinning, payout, balance }) {
    const lines = [
        `**${name}** bet ${cfg.CASH_EMOJI} **${fmt(bet)}** on ${targetLabel(target)}`,
        '',
        `## ${ball(number)} ${number}`
    ];

    if (spinning) {
        lines.push(`${emoji().WHEEL || '🎡'} The wheel is spinning...`);
    } else if (payout > 0) {
        lines.push(`${emoji().WIN || '🎉'} The ball landed on **${number}** (${colorOf(number)}), you won ${cfg.CASH_EMOJI} **${fmt(payout)}**!`);
    } else {
        lines.push(`${emoji().LOSE || '😔'} The ball landed on **${number}** (${colorOf(number)}), you lost ${cfg.CASH_EMOJI} **${fmt(bet)}**.`);
    }

    return new EmbedBuilder()
        .setTitle(`${emoji().WHEEL || '🎡'} Roulette`)
        .setColor(spinning ? COLORS.spinning : payout > 0 ? COLORS.win : COLORS.lose)
        .setThumbnail(avatar)
        .setDescription(lines.join('\n'))
        .setFooter({
            text: spinning ? `Bet: ${fmt(bet)} ${cfg.CASH_NAME}` : `Balance: ${fmt(balance)} ${cfg.CASH_NAME}`,
            iconURL: avatar
        });
}

module.exports = {
    name: 'rl',
    aliases: ['roulette'],
    async execute(message, args) {
        const userId = message.author.id;
        const name = displayName(message);

        if (!acquireGambleLock(userId)) return;
        try {
            // Urutan bebas: "srl 5000 black" / "srl black 5000" / "srl all 17".
            // Angka pertama = jumlah taruhan, angka kedua = nomor tebakan.
            let amountToken = null;
            let target = null;
            for (const raw of args) {
                const token = raw.toLowerCase();
                if (amountToken === null && isAmountToken(token)) amountToken = token;
                else if (!target && parseTarget(token)) target = parseTarget(token);
                else return send(message, errorLine(name, `wrong arguments! Usage: ${usage()}`));
            }
            if (!target) {
                return send(message, errorLine(name, `choose what to bet on! Usage: ${usage()}`));
            }
            if (!canEmbed(message)) {
                return send(message, errorLine(name, 'I need the **Embed Links** permission in this channel to play roulette!'));
            }

            const balance = await Economy.getBetBalance(userId);
            const { bet, error, insufficientBalance } = resolveBet(amountToken ?? undefined, balance);
            if (error) {
                const line = errorLine(name, error);
                return insufficientBalance ? sendTemporaryError(message, line) : send(message, line);
            }

            if (onCooldown(message, 'rl')) return;

            // Hasil ditentukan dan saldo disimpan atomik SEBELUM animasi (aman kalau bot restart).
            const number = spin();
            const payout = payoutFor(target, number, bet);
            const settled = await Economy.settleBet(userId, bet, payout);
            if (!settled) {
                return sendTemporaryError(message, errorLine(name, `you don't have enough ${cfg.CASH_NAME}!`));
            }
            cooldown.start('rl', userId);

            const avatar = message.author.displayAvatarURL({ extension: 'png', size: 256 });
            const base = { name, avatar, bet, target };
            const sent = await message.channel.send({
                embeds: [render({ ...base, number: spin(), spinning: true })],
                allowedMentions: { parse: [] }
            });

            const frames = rl().ANIMATION_FRAMES ?? 3;
            for (let i = 1; i < frames; i += 1) {
                await sleep(rl().FRAME_MS ?? 800);
                await sent.edit({ embeds: [render({ ...base, number: spin(), spinning: true })] }).catch(() => {});
            }
            await sleep(rl().FRAME_MS ?? 800);

            const final = render({ ...base, number, spinning: false, payout, balance: settled.cash });
            await sent.edit({ embeds: [final] })
                .catch(() => message.channel.send({ embeds: [final], allowedMentions: { parse: [] } }).catch(() => {}));
        } finally {
            releaseGambleLock(userId);
        }
    }
};
