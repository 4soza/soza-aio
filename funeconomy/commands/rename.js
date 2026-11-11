// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0 (https://github.com/ChristopherBThai/Discord-OwO-Bot)
const cfg = require('../config');
const Animal = require('../../models/funeconomy/animal');
const { onCooldown } = require('../utils');
const cooldown = require('../cooldown');
const { fail, reply, animalFromToken, cleanNickname } = require('../battle/commandUtil');

// srename <animal> <name>
module.exports = {
    name: 'rename',
    aliases: [],
    async execute(message, args) {
        if (args.length < 2) return fail(message, `The correct command is \`${cfg.PREFIX}rename [animal] [name]\`!`);
        const animal = animalFromToken(args[0]);
        if (!animal) return fail(message, "I couldn't find that animal! D:");
        const input = args.slice(1).join(' ');
        if (input.length > 35) return fail(message, 'The nickname is too long!', 3000);
        const nickname = cleanNickname(input);
        if (!nickname) return fail(message, 'Invalid nickname!', 3000);
        if (onCooldown(message, 'team')) return;

        const result = await Animal.updateOne({ userId: message.author.id, name: animal.key }, { $set: { nickname } });
        if (!result.matchedCount) return fail(message, 'you do not own this pet!', 3000);
        cooldown.start('team', message.author.id);
        return reply(message, '🌱', `you successfully named your pet **${animal.uni}** to **${nickname}**!`);
    }
};
