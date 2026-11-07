const test = require('node:test');
const assert = require('node:assert/strict');
const {
    rankValue, winningRanks, isCorrect, nextPot, stakeOf, drawCard
} = require('../funeconomy/highlowMath');

// Kartu 0-51: rank = n % 13 (0 = As). 6 = "7", 3 = "4", 12 = "K".
const SEVEN = 6;
const FOUR = 3;
const ACE = 0;
const KING = 12;

test('HighLow button amounts match the OwO examples for a 100 bet', () => {
    assert.equal(nextPot(100, 'higher', SEVEN), 203);
    assert.equal(nextPot(100, 'lower', SEVEN), 203);
    assert.equal(nextPot(100, 'same', SEVEN), 1000);
    assert.equal(nextPot(100, 'higher', FOUR), 135);
    assert.equal(nextPot(100, 'lower', FOUR), 407);
});

test('HighLow compounds on the current cash out after a correct guess', () => {
    const game = { bet: 100, streak: 1, pot: 1000 };
    assert.equal(stakeOf(game), 1000);
    assert.equal(nextPot(stakeOf(game), 'higher', FOUR) - game.pot, 357);
    assert.equal(nextPot(stakeOf(game), 'lower', FOUR) - game.pot, 3073);
    assert.equal(nextPot(stakeOf(game), 'same', FOUR) - game.pot, 9000);
    assert.equal(stakeOf({ bet: 100, streak: 0, pot: 0 }), 100);
});

test('Ace is lowest and King is highest, so impossible guesses are blocked', () => {
    assert.equal(rankValue(ACE), 1);
    assert.equal(rankValue(KING), 13);
    assert.equal(winningRanks('lower', ACE), 0);
    assert.equal(winningRanks('higher', KING), 0);
    assert.equal(nextPot(100, 'lower', ACE), null);
    assert.equal(nextPot(100, 'higher', KING), null);
});

test('Higher and lower lose on a tie; same only wins on equal rank in any suit', () => {
    assert.equal(isCorrect('higher', SEVEN, SEVEN + 13), false);
    assert.equal(isCorrect('lower', SEVEN, SEVEN + 13), false);
    assert.equal(isCorrect('same', SEVEN, SEVEN + 26), true);
    assert.equal(isCorrect('higher', SEVEN, 7), true);
    assert.equal(isCorrect('lower', SEVEN, 5), true);
    assert.equal(isCorrect('same', SEVEN, 7), false);
});

test('Drawn cards are always valid 0-51 card numbers', () => {
    for (let i = 0; i < 500; i += 1) {
        const card = drawCard();
        assert.ok(Number.isInteger(card) && card >= 0 && card < 52);
    }
});
