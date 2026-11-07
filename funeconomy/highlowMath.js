const crypto = require('node:crypto');
const cfg = require('./config');

// Kartu disimpan sebagai angka 0-51, sama seperti blackjack: rank = n % 13 (0 = As), suit = floor(n / 13).
// Nilai HighLow: As = 1 (terendah) ... K = 13 (tertinggi). Setiap kartu baru diambil dari dek penuh.
const RANK_COUNT = 13;
const DECK_SIZE = 52;
const GUESSES = ['higher', 'lower', 'same'];

const rtpNumerator = () => Math.round((cfg.HIGHLOW?.RTP ?? 0.94) * 100);
const sameMultiplier = () => cfg.HIGHLOW?.SAME_MULTIPLIER ?? 10;

/** 0-51 -> 1 (As) .. 13 (K). */
function rankValue(card) {
    return (card % RANK_COUNT) + 1;
}

/** Jumlah rank yang membuat tebakan benar dari kartu saat ini. */
function winningRanks(guess, card) {
    const value = rankValue(card);
    if (guess === 'higher') return RANK_COUNT - value;
    if (guess === 'lower') return value - 1;
    if (guess === 'same') return 1;
    return 0;
}

function isCorrect(guess, fromCard, toCard) {
    const from = rankValue(fromCard);
    const to = rankValue(toCard);
    if (guess === 'higher') return to > from;
    if (guess === 'lower') return to < from;
    if (guess === 'same') return to === from;
    return false;
}

/**
 * Nilai Cash Out baru bila tebakan benar. `stake` = taruhan di ronde pertama, lalu nilai Cash Out saat ini.
 * Higher/Lower dibayar adil dikali RTP (13 / jumlah rank menang x 94%). Same dibayar tetap (default 10x).
 * Null kalau tebakan mustahil (mis. Higher pada K) atau angka terlalu besar.
 */
function nextPot(stake, guess, card) {
    if (!Number.isSafeInteger(stake) || stake < 1) return null;
    const ways = winningRanks(guess, card);
    if (ways < 1) return null;

    const value = guess === 'same'
        ? BigInt(stake) * BigInt(sameMultiplier())
        : (BigInt(stake) * BigInt(rtpNumerator()) * BigInt(RANK_COUNT)) / (100n * BigInt(ways));
    return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : null;
}

/** Taruhan yang dilipatgandakan pada tebakan berikutnya. */
function stakeOf(game) {
    return game.streak > 0 ? game.pot : game.bet;
}

function drawCard() {
    return crypto.randomInt(DECK_SIZE);
}

module.exports = {
    RANK_COUNT, DECK_SIZE, GUESSES, rankValue, winningRanks, isCorrect, nextPot, stakeOf, drawCard
};
