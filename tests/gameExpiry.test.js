const test = require('node:test');
const assert = require('node:assert/strict');
const expiry = require('../funeconomy/gameExpiry');
const highlow = require('../funeconomy/highlow');
const mines = require('../funeconomy/mines');
const bj = require('../funeconomy/blackjack');

const GRAY = expiry.EXPIRED_COLOR;
const texts = (json) => json.components.filter((c) => c.type === 10).map((c) => c.content).join('\n');
const buttons = (json) => json.components.filter((c) => c.type === 1).flatMap((row) => row.components);

const hlGame = { userId: '1', bet: 100, pot: 110, streak: 1, status: 'playing', cards: [6, 7] };
const minesGame = {
    userId: '1', bet: 100, mineCount: 3, minePositions: [0, 1, 2], revealed: [4], status: 'playing', version: 1
};

test('Expired color is a gray distinct from the red/green used for results', () => {
    assert.equal(GRAY, 0x616063);
    assert.equal(expiry.EXPIRE_MS, 10 * 60 * 1000);
});

test('HighLow: an expired message is gray and every button is disabled', () => {
    const live = highlow.render(hlGame).toJSON();
    const old = highlow.render(hlGame, { expired: true }).toJSON();
    assert.notEqual(live.accent_color, GRAY);
    assert.equal(old.accent_color, GRAY);
    assert.ok(buttons(live).some((b) => !b.disabled), 'a live game has clickable buttons');
    assert.ok(buttons(old).length >= 4 && buttons(old).every((b) => b.disabled));
});

test('HighLow: a resumed game says "resumed a HighLow game."', () => {
    assert.match(texts(highlow.render(hlGame, { resumed: true }).toJSON()), /resumed a HighLow game\./);
    assert.match(texts(highlow.render(hlGame).toJSON()), /is playing a HighLow game\./);
    assert.match(texts(highlow.render({ ...hlGame, streak: 0 }).toJSON()), /started a HighLow game\./);
});

test('HighLow: finished games keep their result heading even if flagged resumed', () => {
    const lost = highlow.render({ ...hlGame, status: 'lost', lastGuess: 'higher' }, { resumed: true }).toJSON();
    assert.match(texts(lost), /guessed incorrectly/);
    assert.equal(lost.accent_color, 0xff0000);
});

test('Mines: an expired board is gray and every button is disabled', () => {
    const live = mines.render(minesGame, '1').toJSON();
    const old = mines.render(minesGame, '1', { expired: true }).toJSON();
    assert.notEqual(live.accent_color, GRAY);
    assert.equal(old.accent_color, GRAY);
    assert.ok(buttons(live).some((b) => !b.disabled));
    assert.equal(buttons(old).length, 10); // 9 petak + Cash Out
    assert.ok(buttons(old).every((b) => b.disabled));
});

test('Mines: a resumed game says "resumed a mines game." and result colors are bright', () => {
    assert.match(texts(mines.render(minesGame, '1', { resumed: true }).toJSON()), /resumed a mines game\./);
    assert.equal(mines.render({ ...minesGame, status: 'lost', hitPosition: 0 }, '1').toJSON().accent_color, 0xff0000);
    assert.equal(mines.render({ ...minesGame, status: 'cashed_out', payout: 120 }, '1').toJSON().accent_color, 0x00ff00);
});

test('Blackjack: resuming shows "resuming previous game", otherwise "game in progress"', () => {
    const game = { bet: 10, player: [6, 7], dealer: [0, 10] };
    assert.equal(bj.render(game, { name: 'A' }).data.footer.text.endsWith('game in progress'), true);
    assert.equal(bj.render(game, { name: 'A', resuming: true }).data.footer.text.endsWith('resuming previous game'), true);
});

test('schedule runs the task once, and rescheduling or cancel replaces it', async () => {
    const calls = [];
    expiry.schedule('t', async () => calls.push('first'), 20);
    expiry.schedule('t', async () => calls.push('second'), 20); // menggantikan yang pertama
    expiry.schedule('c', async () => calls.push('cancelled'), 20);
    expiry.cancel('c');
    await new Promise((resolve) => setTimeout(resolve, 80));
    assert.deepEqual(calls, ['second']);
});

test('editMessage returns false instead of throwing when the message is gone', async () => {
    const client = { channels: { fetch: async () => { throw new Error('Unknown Channel'); } } };
    assert.equal(await expiry.editMessage(client, '1', '2', { components: [] }), false);
    assert.equal(await expiry.editMessage(client, null, null, {}), false);
    const edits = [];
    const ok = { channels: { fetch: async () => ({ messages: { fetch: async () => ({ edit: async (o) => edits.push(o) }) } }) } };
    assert.equal(await expiry.editMessage(ok, '1', '2', { a: 1 }), true);
    assert.deepEqual(edits, [{ a: 1 }]);
});
