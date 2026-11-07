const test = require('node:test');
const assert = require('node:assert/strict');
const cfg = require('../funeconomy/config');
const { ensureLoaded, cardEmoji, backEmoji } = require('../funeconomy/cardEmoji');
const { cardRow, render: renderHighLow } = require('../funeconomy/highlow');
const bj = require('../funeconomy/blackjack');

// Catatan: modul cardEmoji menyimpan emoji yang dimuat di level modul. Test pertama sengaja berjalan
// SEBELUM emoji dimuat (kondisi "belum diunggah"); test setelahnya memuat emoji tiruan.
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['s', 'h', 'd', 'c'];
const arrow = ` ${cfg.HIGHLOW.ARROW} `;

function fakeClient({ withFlip = true } = {}) {
    const cache = new Map();
    let id = 1000;
    const add = (name, animated) => cache.set(String(id), { id: String(id++), name, animated });
    for (const s of SUITS) {
        for (const r of RANKS) {
            add(`card_${r}${s}`, false);
            if (withFlip) add(`card_${r}${s}_flip`, true);
        }
    }
    add('card_back', false);
    add('unrelated_emoji', false);
    return { application: { emojis: { cache, fetch: async () => cache } }, cache };
}

const find = (client, name) => {
    const e = [...client.cache.values()].find((x) => x.name === name);
    return `<${e.animated ? 'a' : ''}:${e.name}:${e.id}>`;
};

test('Before any emoji is loaded, cards fall back to plain rank text', () => {
    assert.equal(cardEmoji(6), null);
    assert.equal(backEmoji(), null);
    assert.equal(cardRow({ status: 'playing', cards: [6] }), `\`7\`${arrow}\`??\``);
});

test('ensureLoaded tolerates a missing application and a failing fetch', async () => {
    await ensureLoaded(undefined);
    await ensureLoaded({});
    const errors = [];
    const original = console.error;
    console.error = (...args) => errors.push(args.join(' '));
    try {
        await ensureLoaded({ application: { emojis: { cache: new Map(), fetch: async () => { throw new Error('boom'); } } } });
    } finally {
        console.error = original;
    }
    assert.equal(errors.length, 1);
    assert.match(errors[0], /boom/);
});

test('Card numbers map to the right emoji: rank order and suit order', () => {
    const client = fakeClient();
    return ensureLoaded(client).then(() => {
        assert.equal(cardEmoji(6), find(client, 'card_7s'));    // 7 of spades
        assert.equal(cardEmoji(13), find(client, 'card_Ah'));   // A of hearts
        assert.equal(cardEmoji(38), find(client, 'card_Kd'));   // K of diamonds
        assert.equal(cardEmoji(48), find(client, 'card_10c'));  // 10 of clubs
        assert.equal(cardEmoji(6, { flip: true }), find(client, 'card_7s_flip'));
        assert.match(cardEmoji(6, { flip: true }), /^<a:/);
        assert.match(cardEmoji(6), /^<:/);
        assert.equal(backEmoji(), find(client, 'card_back'));
    });
});

test('flip falls back to the static emoji when the flip version is missing', async () => {
    const client = fakeClient({ withFlip: false });
    await ensureLoaded(client);
    assert.equal(cardEmoji(6, { flip: true }), find(client, 'card_7s'));
});

test('HighLow: the newest card flips, older cards and the back card are static', async () => {
    const client = fakeClient();
    await ensureLoaded(client);
    const row = cardRow({ status: 'playing', cards: [1, 2, 6, 7] }).split(arrow);
    assert.deepEqual(row, [find(client, 'card_7s'), find(client, 'card_8s_flip'), find(client, 'card_back')]);
});

test('HighLow: the start card flips next to the back card', async () => {
    const client = fakeClient();
    await ensureLoaded(client);
    assert.deepEqual(cardRow({ status: 'playing', cards: [6] }).split(arrow),
        [find(client, 'card_7s_flip'), find(client, 'card_back')]);
});

test('HighLow: a lost game flips the losing card, a cash out flips nothing', async () => {
    const client = fakeClient();
    await ensureLoaded(client);
    assert.deepEqual(cardRow({ status: 'lost', cards: [5, 6, 7] }).split(arrow),
        [find(client, 'card_6s'), find(client, 'card_7s'), find(client, 'card_8s_flip')]);
    assert.deepEqual(cardRow({ status: 'cashed_out', cards: [5, 6, 7] }).split(arrow),
        [find(client, 'card_6s'), find(client, 'card_7s'), find(client, 'card_8s')]);
});

test('Blackjack: only the cards at or after the flip index animate', async () => {
    const client = fakeClient();
    await ensureLoaded(client);
    const game = { bet: 10, player: [6, 7, 25], dealer: [0, 10] }; // 7s 8s Kh | As Js
    const field = (embed, i) => embed.data.fields[i].value;

    const none = bj.render(game, { name: 'A', botName: 'B' });
    assert.equal(field(none, 0), [find(client, 'card_7s'), find(client, 'card_8s'), find(client, 'card_Kh')].join(' '));
    assert.equal(field(none, 1), `${find(client, 'card_As')} ${find(client, 'card_back')}`);

    const hit = bj.render(game, { name: 'A', botName: 'B', flip: { player: 2 } });
    assert.equal(field(hit, 0), [find(client, 'card_7s'), find(client, 'card_8s'), find(client, 'card_Kh_flip')].join(' '));
    assert.equal(field(hit, 1), `${find(client, 'card_As')} ${find(client, 'card_back')}`);

    const deal = bj.render({ ...game, player: [6, 7] }, { name: 'A', botName: 'B', flip: { player: 0, dealer: 0 } });
    assert.equal(field(deal, 0), [find(client, 'card_7s_flip'), find(client, 'card_8s_flip')].join(' '));
    assert.equal(field(deal, 1), `${find(client, 'card_As_flip')} ${find(client, 'card_back')}`);
});

test('Blackjack: the dealer reveal flips the hidden card and any drawn cards', async () => {
    const client = fakeClient();
    await ensureLoaded(client);
    const game = { bet: 10, player: [6, 7], dealer: [0, 10, 4] }; // As Js 5s
    const result = { outcome: 'lose', payout: 0 };
    const embed = bj.render(game, { name: 'A', botName: 'B', result, flip: { dealer: 1 } });
    assert.equal(embed.data.fields[1].value,
        [find(client, 'card_As'), find(client, 'card_Js_flip'), find(client, 'card_5s_flip')].join(' '));
    assert.equal(embed.data.fields[0].value, [find(client, 'card_7s'), find(client, 'card_8s')].join(' '));
});

const textBlocks = (game) => renderHighLow(game).toJSON().components.filter((c) => c.type === 10).map((c) => c.content);

test('HighLow: the card row is its own text block (only an optional heading marker + emoji)', async () => {
    const client = fakeClient();
    await ensureLoaded(client);
    const game = { userId: '1', bet: 100, pot: 100, streak: 0, status: 'playing', cards: [6] };
    const texts = textBlocks(game);
    const row = cardRow(game);
    const block = texts.find((t) => t.endsWith(row));
    assert.ok(block, 'card row must be a separate text display');
    assert.match(block.slice(0, block.length - row.length), /^(#{1,3} )?$/, 'only a heading marker may precede the row');
    assert.equal(row.replace(/<a?:\w+:\d+>/g, '').trim(), '', 'card row must contain only emoji');
    assert.ok(texts.filter((t) => t !== block).every((t) => !/<a?:card_/.test(t)), 'no card emoji mixed into other text');
});

test('HighLow: CARD_HEADING controls the card row size and defaults to a big heading', async () => {
    const client = fakeClient();
    await ensureLoaded(client);
    const game = { userId: '1', bet: 100, pot: 100, streak: 0, status: 'playing', cards: [6] };
    const row = cardRow(game);
    const saved = cfg.HIGHLOW.CARD_HEADING;
    try {
        delete cfg.HIGHLOW.CARD_HEADING;
        assert.ok(textBlocks(game).includes(`# ${row}`));
        cfg.HIGHLOW.CARD_HEADING = '##';
        assert.ok(textBlocks(game).includes(`## ${row}`));
        cfg.HIGHLOW.CARD_HEADING = '';
        assert.ok(textBlocks(game).includes(row));
    } finally {
        if (saved === undefined) delete cfg.HIGHLOW.CARD_HEADING;
        else cfg.HIGHLOW.CARD_HEADING = saved;
    }
});
