// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0 (https://github.com/ChristopherBThai/Discord-OwO-Bot)
const friend = require('../battle/battleFriend');
const { onCooldown } = require('../utils');
const cooldown = require('../cooldown');
const { fail } = require('../battle/commandUtil');

// sab = terima tantangan battle teman di channel yang sama
module.exports = {
    name: 'ab',
    aliases: ['acceptbattle'],
    async execute(message, args, client) {
        if (onCooldown(message, 'battle')) return;
        const error = await friend.accept({ guild: message.guild, channel: message.channel, acceptor: message.author, client });
        if (error) return fail(message, error, 3000);
        cooldown.start('battle', message.author.id);
    }
};
