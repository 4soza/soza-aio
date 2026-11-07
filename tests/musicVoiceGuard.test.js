const test = require('node:test');
const assert = require('node:assert/strict');
const { isInBotVoiceChannel } = require('../utils/musicVoiceGuard');

function makeInteraction({ botChannel, userChannel }) {
    return {
        guild: { members: { me: { voice: { channelId: botChannel } } } },
        member: { voice: { channelId: userChannel } },
    };
}

test('member in the same voice channel as the bot can use music buttons', () => {
    assert.equal(isInBotVoiceChannel(makeInteraction({ botChannel: 'vc1', userChannel: 'vc1' })), true);
});

test('member not in any voice channel cannot use music buttons', () => {
    assert.equal(isInBotVoiceChannel(makeInteraction({ botChannel: 'vc1', userChannel: null })), false);
});

test('member in a different voice channel cannot use music buttons', () => {
    assert.equal(isInBotVoiceChannel(makeInteraction({ botChannel: 'vc1', userChannel: 'vc2' })), false);
});

test('falls back to the player voice channel when the bot voice state is not cached', () => {
    const interaction = makeInteraction({ botChannel: null, userChannel: 'vc1' });
    assert.equal(isInBotVoiceChannel(interaction, { voiceChannel: 'vc1' }), true);
    assert.equal(isInBotVoiceChannel(interaction, { voiceChannel: 'vc9' }), false);
});

test('nobody can use the buttons when the bot is not in voice', () => {
    assert.equal(isInBotVoiceChannel(makeInteraction({ botChannel: null, userChannel: 'vc1' })), false);
});
