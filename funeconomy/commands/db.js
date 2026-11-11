// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0 (https://github.com/ChristopherBThai/Discord-OwO-Bot)
const friend = require('../battle/battleFriend');
const { send } = require('../utils');
const { reply, fail, userName } = require('../battle/commandUtil');

// sdb = tolak tantangan battle teman
module.exports = {
    name: 'db',
    aliases: ['declinebattle'],
    async execute(message, args, client) {
        const result = await friend.decline({ user: message.author, client });
        if (!result) return fail(message, 'You do not have any pending battles!', 3000);
        const other = result.other ? `**${userName(message.guild, result.other)}**` : 'an opponent';
        return reply(message, '🔪', `You declined the battle request from ${other}!`);
    }
};
