// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0 (https://github.com/ChristopherBThai/Discord-OwO-Bot)
const cooldown = require('../cooldown');
const { onCooldown } = require('../utils');
const marriageView = require('../shop/marriageView');

// smarry @user {ringID} = propose (or upgrade ring when already married to them) | smarry = show marriage
module.exports = {
    name: 'marry',
    aliases: ['propose', 'marriage', 'wife', 'husband'],
    async execute(message, args, client) {
        if (onCooldown(message, 'marry')) return;
        cooldown.start('marry', message.author.id);
        return marriageView.marry(message, args, client);
    }
};
