const test = require('node:test');
const assert = require('node:assert/strict');
const { matchMusicPrefix } = require('../utils/musicPrefix');
const { getMatchedPrefix } = require('../utils/prefix');

test('s!play and s!p both run the play command with the song as args', () => {
    assert.deepEqual(matchMusicPrefix('s!play royalty egzod'), {
        prefix: 's!', typed: 'play', commandName: 'play', args: ['royalty', 'egzod'],
    });
    assert.equal(matchMusicPrefix('s!p royalty').commandName, 'play');
    assert.deepEqual(matchMusicPrefix('S!P royalty').args, ['royalty']);
});

test('s! prefix only works for music commands', () => {
    assert.equal(matchMusicPrefix('s!purge 10'), null);
    assert.equal(matchMusicPrefix('s!help'), null);
    assert.equal(matchMusicPrefix('.play royalty'), null);
    assert.equal(matchMusicPrefix('shl 100'), null);
});

test('the default "." prefix is unchanged and does not accept s!', () => {
    assert.equal(getMatchedPrefix('.play royalty', null), '.');
    assert.equal(getMatchedPrefix('s!play royalty', null), null);
});
