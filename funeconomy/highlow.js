const {
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');
const cfg = require('./config');
const cooldown = require('./cooldown');
const HighLow = require('../models/funeconomy/highlow');
const Economy = require('../models/funeconomy/economy');
const { cardLabel } = require('./blackjack');
const {
    GUESSES, isCorrect, nextPot, stakeOf, drawCard
} = require('./highlowMath');
const {
    fmt, displayName, send, sendTemporaryError, resolveBet, errorLine,
    acquireGambleLock, releaseGambleLock, onCooldown
} = require('./utils');

const BUTTON_PREFIX = 'fhl';
const TERMINAL_STATES = new Set(['lost', 'cashed_out']);
const GUESS_LABELS = { higher: 'Higher', lower: 'Lower', same: 'Same' };
const HIDDEN_CARD = '`??`';
const MAX_SHOWN_CARDS = 3; // seperti OwO: selalu maksimal 3 slot kartu

const hl = () => cfg.HIGHLOW || {};
const card = (n) => `\`${cardLabel(n)}\``;
const formatMultiplier = (value) => `${value.toFixed(2)}x`;
const currentCardOf = (game) => game.status === 'lost'
    ? game.cards[game.cards.length - 2]
    : game.cards[game.cards.length - 1];

/**
 * Seperti OwO, baris kartu selalu maksimal 3 slot:
 * - masih main: 2 kartu terakhir + `??`
 * - selesai: 3 kartu terakhir
 */
function cardRow(game) {
    const ended = TERMINAL_STATES.has(game.status);
    const visible = ended ? MAX_SHOWN_CARDS : MAX_SHOWN_CARDS - 1;
    const shown = game.cards.slice(-visible).map(card);
    if (!ended) shown.push(HIDDEN_CARD);
    return shown.join(` ${hl().ARROW || '▶'} `);
}

function render(game) {
    const userId = game.userId;
    const ended = TERMINAL_STATES.has(game.status);
    const current = currentCardOf(game);
    const currentAmount = game.status === 'cashed_out' ? game.payout : game.pot;
    const emoji = hl().EMOJI || {};

    let heading;
    if (game.status === 'lost') heading = `### ${emoji.LOSE || '👎'} **<@${userId}> guessed incorrectly!!**`;
    else if (game.status === 'cashed_out') heading = `### ${emoji.CASHOUT || '💰'} **<@${userId}> cashed out!**`;
    else if (game.streak === 0) heading = `### ${emoji.GAME || '🃏'} **<@${userId}> started a HighLow game.**`;
    else heading = `### ${emoji.GAME || '🃏'} **<@${userId}> is playing a HighLow game.**`;

    const cashLabel = game.status === 'cashed_out' ? 'Winnings' : 'Cash Out';
    const cashValue = `\`${fmt(currentAmount)}\` \`(${formatMultiplier(currentAmount / game.bet)})\``;
    const summary = `-# **Bet:** \`${fmt(game.bet)}\`　 **Streak:** \`${game.streak}\`　 **${cashLabel}:** ${cashValue}`;

    let prompt;
    if (game.status === 'lost') {
        prompt = `You guessed \`${GUESS_LABELS[game.lastGuess] || '?'}\`. You lost.`;
    } else if (game.status === 'cashed_out') {
        prompt = `You cashed out ${cfg.CASH_EMOJI} **${fmt(game.payout)}**!`;
    } else {
        prompt = 'Is the next card higher, lower, or the same value?';
    }
    const body = [cardRow(game), '', prompt, `-# Current Card: ${card(current)}`].join('\n');

    const accentColor = game.status === 'lost'
        ? 0xe74c3c
        : game.streak > 0 || game.status === 'cashed_out'
            ? 0x2ee820
            : 0x7ab8f5;

    const stake = stakeOf(game);
    const guessRow = new ActionRowBuilder();
    for (const guess of GUESSES) {
        const pot = nextPot(stake, guess, current);
        const label = pot === null ? GUESS_LABELS[guess] : `${GUESS_LABELS[guess]} (+${fmt(pot - game.pot)})`;
        guessRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`${BUTTON_PREFIX}:${guess}:${userId}`)
                .setLabel(label)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(ended || pot === null)
        );
    }

    const cashOut = new ButtonBuilder()
        .setCustomId(`${BUTTON_PREFIX}:cash:${userId}`)
        .setLabel(game.streak > 0 ? `Cash Out: ${fmt(game.status === 'cashed_out' ? game.payout : game.pot)}` : 'Cash Out')
        .setStyle(ButtonStyle.Success)
        .setDisabled(ended || game.streak === 0);

    return new ContainerBuilder()
        .setAccentColor(accentColor)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(heading))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(summary))
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(body))
        .addActionRowComponents(guessRow)
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addActionRowComponents(new ActionRowBuilder().addComponents(cashOut));
}

function messageOptions(game) {
    return { components: [render(game)], allowedMentions: { parse: [] } };
}

async function retireOldMessage(client, game) {
    if (!game.channelId || !game.messageId) return;
    try {
        const channel = await client.channels.fetch(game.channelId);
        const oldMessage = await channel?.messages?.fetch(game.messageId);
        await oldMessage?.edit({ components: [] });
    } catch {
        // Pesan lama yang terhapus tidak menghalangi game dilanjutkan.
    }
}

async function postGame(message, game, client) {
    const sent = await message.channel.send({ ...messageOptions(game), flags: MessageFlags.IsComponentsV2 });
    const attached = await HighLow.findOneAndUpdate(
        { _id: game._id, userId: game.userId, status: 'playing', version: game.version },
        { $set: { channelId: message.channel.id, messageId: sent.id } },
        { new: true }
    ).lean();

    if (!attached) {
        await sent.edit({ components: [] }).catch(() => {});
        return false;
    }
    await retireOldMessage(client, game);
    return true;
}

/** Potong taruhan tepat sekali; penanda di akun mencegah potongan ganda saat dilanjutkan setelah restart. */
async function prepareGame(userId, game) {
    if (game.status !== 'pending') return game;

    const debited = await Economy.deductHighLowBet(userId, game._id, game.bet);
    if (!debited) {
        await HighLow.deleteOne({ _id: game._id, userId, status: 'pending' });
        return null;
    }
    return await HighLow.findOneAndUpdate(
        { _id: game._id, userId, status: 'pending' },
        { $set: { status: 'playing' }, $inc: { version: 1 } },
        { new: true }
    ).lean() || await HighLow.findOne({ _id: game._id, userId }).lean();
}

/** Bayar hasil cash out tepat sekali, lalu hapus game aktif. */
async function completeGame(game) {
    const finalGame = await HighLow.findOne({ _id: game._id, userId: game.userId }).lean();
    if (!finalGame || !TERMINAL_STATES.has(finalGame.status)) return finalGame;

    if (finalGame.payout > 0) {
        for (let attempt = 1; attempt <= 3; attempt += 1) {
            try {
                await Economy.addHighLowPayout(finalGame.userId, finalGame._id, finalGame.payout);
                break;
            } catch (error) {
                if (attempt === 3) {
                    console.error(`[FUNECONOMY] HighLow payout FAILED for ${finalGame.userId}, amount ${finalGame.payout}:`, error);
                    throw error;
                }
            }
        }
    }

    await HighLow.deleteOne({ _id: finalGame._id, userId: finalGame.userId, status: finalGame.status });
    return finalGame;
}

async function sendCurrent(interaction, game) {
    if (game && TERMINAL_STATES.has(game.status)) game = await completeGame(game);
    if (!game) return interaction.editReply({ components: [] });
    return interaction.editReply(messageOptions(game));
}

async function handleButton(interaction) {
    const [, action, ownerId] = interaction.customId.split(':');
    if (![...GUESSES, 'cash'].includes(action) || !ownerId) return;

    if (interaction.user.id !== ownerId) {
        return interaction.reply({ content: "This isn't your HighLow game!", flags: MessageFlags.Ephemeral });
    }
    if (!acquireGambleLock(ownerId)) {
        return interaction.reply({
            content: 'Your game is already processing an action. Try again in a moment.',
            flags: MessageFlags.Ephemeral
        });
    }

    try {
        const game = await HighLow.findOne({ userId: ownerId }).lean();
        if (!game) return interaction.update({ components: [] });
        if (!game.messageId || game.messageId !== interaction.message.id) {
            return interaction.reply({
                content: `This game is on a newer message. Type \`${cfg.PREFIX}hl\` to resume it.`,
                flags: MessageFlags.Ephemeral
            });
        }

        await interaction.deferUpdate();
        const active = game.status === 'pending' ? await prepareGame(ownerId, game) : game;
        if (!active) return interaction.editReply({ components: [] });
        if (TERMINAL_STATES.has(active.status)) return sendCurrent(interaction, active);

        const versionFilter = { _id: active._id, userId: ownerId, status: 'playing', version: active.version };

        if (action === 'cash') {
            if (active.streak === 0) {
                return interaction.followUp({ content: 'Guess at least one card before cashing out.', flags: MessageFlags.Ephemeral });
            }
            const finished = await HighLow.findOneAndUpdate(
                versionFilter,
                { $set: { status: 'cashed_out', payout: active.pot }, $inc: { version: 1 } },
                { new: true }
            ).lean();
            if (!finished) return sendCurrent(interaction, await HighLow.findOne({ userId: ownerId }).lean());
            return interaction.editReply(messageOptions(await completeGame(finished)));
        }

        const current = active.cards[active.cards.length - 1];
        const pot = nextPot(stakeOf(active), action, current);
        if (pot === null) {
            return interaction.followUp({ content: "You can't make that guess with this card.", flags: MessageFlags.Ephemeral });
        }

        const next = drawCard();
        const cards = [...active.cards, next];
        const update = isCorrect(action, current, next)
            ? { $set: { cards, pot, streak: active.streak + 1, lastGuess: action }, $inc: { version: 1 } }
            : { $set: { cards, status: 'lost', payout: 0, lastGuess: action }, $inc: { version: 1 } };

        const updated = await HighLow.findOneAndUpdate(versionFilter, update, { new: true }).lean();
        if (!updated) return sendCurrent(interaction, await HighLow.findOne({ userId: ownerId }).lean());
        if (updated.status === 'lost') return interaction.editReply(messageOptions(await completeGame(updated)));
        return interaction.editReply(messageOptions(updated));
    } catch (error) {
        console.error('[FUNECONOMY] HighLow button error:', error);
        const reply = {
            content: `Your game is saved. Try the button again or type \`${cfg.PREFIX}hl\` to resume.`,
            flags: MessageFlags.Ephemeral
        };
        if (interaction.deferred || interaction.replied) await interaction.followUp(reply).catch(() => {});
        else await interaction.reply(reply).catch(() => {});
    } finally {
        releaseGambleLock(ownerId);
    }
}

async function startCommand(message, args, client) {
    const userId = message.author.id;
    const name = displayName(message);
    if (!acquireGambleLock(userId)) return;

    try {
        // Game lama? Selesaikan yang sudah berakhir, atau lanjutkan di pesan baru (ketik ulang "shl").
        let game = await HighLow.findOne({ userId }).lean();
        if (game && TERMINAL_STATES.has(game.status)) {
            await completeGame(game);
            game = await HighLow.findOne({ userId }).lean();
        }
        if (game) {
            game = await prepareGame(userId, game);
            if (!game) {
                return sendTemporaryError(message, errorLine(name, `you don't have enough ${cfg.CASH_NAME} to start that game!`));
            }
            return await postGame(message, game, client)
                || send(message, errorLine(name, `your game changed while resuming. Type \`${cfg.PREFIX}hl\` again.`));
        }

        if (args.length > 1) {
            return send(message, errorLine(name, `use \`${cfg.PREFIX}hl <bet|all>\`.`));
        }
        const balance = await Economy.getCash(userId);
        const { bet, error, insufficientBalance } = resolveBet(args[0], balance);
        if (error) {
            const reply = errorLine(name, error);
            return insufficientBalance ? sendTemporaryError(message, reply) : send(message, reply);
        }
        if (onCooldown(message, 'hl')) return;

        try {
            game = (await HighLow.create({ userId, bet, cards: [drawCard()], status: 'pending' })).toObject();
        } catch (error) {
            if (error?.code !== 11000) throw error;
            return; // command lain baru saja membuat game
        }

        game = await prepareGame(userId, game);
        if (!game) {
            return sendTemporaryError(message, errorLine(name, `you don't have enough ${cfg.CASH_NAME} to start that game!`));
        }
        if (game.status !== 'playing') {
            return send(message, errorLine(name, 'could not start your game. Please try again.'));
        }

        cooldown.start('hl', userId);
        return await postGame(message, game, client)
            || send(message, errorLine(name, `your game changed while starting. Type \`${cfg.PREFIX}hl\` again.`));
    } finally {
        releaseGambleLock(userId);
    }
}

module.exports = { BUTTON_PREFIX, render, cardRow, handleButton, startCommand };
