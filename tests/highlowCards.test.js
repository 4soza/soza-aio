const test = require('node:test');
const assert = require('node:assert/strict');
const cfg = require('../funeconomy/config');
const { cardRow } = require('../funeconomy/highlow');
const { cardLabel } = require('../funeconomy/blackjack');

// Pemisah antar kartu = panah dari config (bisa berupa emoji kustom).
const slots = (row) => row.split(` ${cfg.HIGHLOW.ARROW} `);
const label = (n) => `\`${cardLabel(n)}\``;

test('Card text is only the rank, never a suit symbol', () => {
    assert.equal(cardLabel(6), '7');
    assert.equal(cardLabel(0), 'A');
    assert.equal(cardLabel(25), 'K'); // K of hearts
    assert.equal(cardLabel(39), 'A'); // A of clubs
    for (let n = 0; n < 52; n += 1) assert.match(cardLabel(n), /^(A|[2-9]|10|J|Q|K)$/);
});

test('HighLow shows the start card plus the hidden card', () => {
    assert.deepEqual(slots(cardRow({ status: 'playing', cards: [6] })), [label(6), '`??`']);
});

test('HighLow shows only the last 2 cards plus the hidden card during a long streak', () => {
    const row = slots(cardRow({ status: 'playing', cards: [1, 2, 3, 4, 5, 6, 7] }));
    assert.deepEqual(row, [label(6), label(7), '`??`']);
});

test('HighLow shows only the last 3 cards after the game ends', () => {
    assert.deepEqual(slots(cardRow({ status: 'lost', cards: [1, 2, 3, 4, 5] })), [label(3), label(4), label(5)]);
    assert.deepEqual(slots(cardRow({ status: 'cashed_out', cards: [1, 2, 3, 4] })), [label(2), label(3), label(4)]);
});
