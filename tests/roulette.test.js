const test = require('node:test');
const assert = require('node:assert/strict');
const {
    POCKETS, colorOf, parseTarget, isWin, payoutFor, spin
} = require('../funeconomy/rouletteMath');

test('the wheel has 0-36 with 0 green, 18 red, and 18 black', () => {
    assert.equal(POCKETS, 37);
    const counts = { green: 0, red: 0, black: 0 };
    for (let n = 0; n <= 36; n += 1) counts[colorOf(n)] += 1;
    assert.deepEqual(counts, { green: 1, red: 18, black: 18 });
    assert.equal(colorOf(0), 'green');
    assert.equal(colorOf(1), 'red');
    assert.equal(colorOf(2), 'black');
    assert.equal(colorOf(10), 'black');
    assert.equal(colorOf(19), 'red');
    assert.equal(colorOf(24), 'black');
    assert.equal(colorOf(34), 'red');
});

test('red and black pay 2x', () => {
    assert.equal(payoutFor(parseTarget('black'), 24, 5000), 10000);
    assert.equal(payoutFor(parseTarget('red'), 34, 100), 200);
    assert.equal(payoutFor(parseTarget('black'), 34, 100), 0);
});

test('0 (green) loses every red/black/odd/even/low/high bet', () => {
    for (const kind of ['red', 'black', 'odd', 'even', 'low', 'high']) {
        assert.equal(payoutFor({ kind }, 0, 246617), 0, kind);
    }
});

test('green and a single number pay 36x', () => {
    assert.equal(payoutFor(parseTarget('green'), 0, 100), 3600);
    assert.equal(payoutFor(parseTarget('17'), 17, 100), 3600);
    assert.equal(payoutFor(parseTarget('0'), 0, 100), 3600);
    assert.equal(payoutFor(parseTarget('17'), 18, 100), 0);
});

test('odd/even and low/high follow the number', () => {
    assert.equal(isWin({ kind: 'odd' }, 7), true);
    assert.equal(isWin({ kind: 'even' }, 7), false);
    assert.equal(isWin({ kind: 'low' }, 18), true);
    assert.equal(isWin({ kind: 'high' }, 18), false);
    assert.equal(isWin({ kind: 'high' }, 19), true);
});

test('Indonesian words and short forms are accepted, numbers above 36 are not', () => {
    assert.deepEqual(parseTarget('merah'), { kind: 'red' });
    assert.deepEqual(parseTarget('hitam'), { kind: 'black' });
    assert.deepEqual(parseTarget('hijau'), { kind: 'green' });
    assert.deepEqual(parseTarget('B'), { kind: 'black' });
    assert.equal(parseTarget('37'), null);
    assert.equal(parseTarget('blue'), null);
});

test('spin always lands on 0-36', () => {
    assert.equal(spin(() => 0), 0);
    for (let i = 0; i < 1000; i += 1) {
        const n = spin();
        assert.ok(n >= 0 && n <= 36);
    }
});
