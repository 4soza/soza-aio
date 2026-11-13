const { displayName, onCooldown } = require('../utils');
const cooldown = require('../cooldown');
const questView = require('../quests/questView');
const { track } = require('../inactivity');

// squest -> daftar quest (alias: sq). Klaim, kunci, dan reroll lewat tombol.
module.exports = {
    name: 'quest',
    aliases: ['q', 'quests'],
    async execute(message) {
        if (onCooldown(message, 'quest')) return;
        cooldown.start('quest', message.author.id);
        const payload = await questView.buildMessage(message.author.id, displayName(message), 'quests');
        const sent = await message.channel.send(payload);
        track(sent);
        return sent;
    }
};
