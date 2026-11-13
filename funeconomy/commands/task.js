const { displayName, onCooldown } = require('../utils');
const cooldown = require('../cooldown');
const questView = require('../quests/questView');
const { track } = require('../inactivity');

// stask [weekly]  -> checklist harian/mingguan (alias: scl, schecklist)
module.exports = {
    name: 'task',
    aliases: ['tasks', 'cl', 'checklist'],
    async execute(message, args) {
        if (onCooldown(message, 'task')) return;
        cooldown.start('task', message.author.id);
        const tab = /^w/i.test(args[0] || '') ? 'weekly' : 'daily';
        const payload = await questView.buildMessage(message.author.id, displayName(message), tab);
        const sent = await message.channel.send(payload);
        track(sent);
        return sent;
    }
};
