const test = require('node:test');
const assert = require('node:assert/strict');
const view = require('../funeconomy/battle/settingsView');

const state = (extra = {}) => ({
    ownerId: '123', ownerName: 'soza',
    settings: { display: 'image', speed: 'short', logs: 'false' },
    changes: [], updatedAt: Date.now(), ...extra
});
const buttons = (payload) => payload.components[0].toJSON().components
    .filter((c) => c.accessory).map((c) => c.accessory);

test('Battle settings session expires after 10 minutes', () => {
    assert.equal(view.EXPIRE_MS, 10 * 60 * 1000);
});

test('Clicking a setting moves to the next choice and wraps around', () => {
    assert.equal(view.nextValue('display', 'image'), 'compact');
    assert.equal(view.nextValue('display', 'text'), 'image');
    assert.equal(view.nextValue('speed', 'lengthy'), 'instant');
    assert.equal(view.nextValue('logs', 'false'), 'true');
    assert.equal(view.nextValue('logs', 'link'), 'false');
});

test('Choices are saved with the same values the battle code reads', () => {
    assert.equal(view.storedValue('display', 'compact'), 'compact');
    assert.equal(view.storedValue('speed', 'instant'), 0);
    assert.equal(view.storedValue('speed', 'lengthy'), 2);
    assert.equal(view.storedValue('logs', 'true'), 1);
    assert.equal(view.storedValue('logs', 'link'), 2);
});

test('Each setting has a button showing its current value', () => {
    const b = buttons(view.build(state({ settings: { display: 'compact', speed: 'lengthy', logs: 'link' } })));
    assert.deepEqual(b.map((x) => x.custom_id), ['fbs:display:123', 'fbs:speed:123', 'fbs:logs:123']);
    assert.ok(b[0].label.endsWith('compact'));
    assert.ok(b[2].label.endsWith('link'));
    assert.ok(b.every((x) => !x.disabled));
});

test('An expired session disables every button', () => {
    const b = buttons(view.build(state({ expired: true })));
    assert.equal(b.length, 3);
    assert.ok(b.every((x) => x.disabled));
});
