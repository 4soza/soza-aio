// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0 (https://github.com/ChristopherBThai/Discord-OwO-Bot)
const cooldown = require('../cooldown');
const { onCooldown } = require('../utils');
const marriageView = require('../shop/marriageView');

module.exports = {
    name: 'divorce',
    aliases: [],
    async execute(message, args, client) {
        if (onCooldown(message, 'divorce')) return;
        cooldown.start('divorce', message.author.id);
        return marriageView.divorce(message, client);
    }
};
