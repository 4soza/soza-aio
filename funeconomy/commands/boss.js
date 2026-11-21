const bossService = require('../boss/bossService');
const bossView = require('../boss/bossView');
const { fail } = require('../battle/commandUtil');
const { onCooldown } = require('../utils');

// sboss = tampilkan guild boss server ini (selalu ada, bisa dilawan bersama-sama)
module.exports = {
    name: 'boss',
    aliases: [],
    async execute(message) {
        if (!message.guild) return fail(message, 'this command only works in a server!');
        if (onCooldown(message, 'boss')) return;
        const doc = await bossService.currentBoss(message.guild.id);
        if (!doc) return fail(message, 'could not find the boss, try again!');
        const payload = await bossView.render(doc);
        return message.channel.send(payload);
    }
};
