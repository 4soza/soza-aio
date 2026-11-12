// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0 (https://github.com/ChristopherBThai/Discord-OwO-Bot)
const cfg = require('../config');
const settingsDb = require('../battle/settingsDb');
const settingsView = require('../battle/settingsView');
const { onCooldown } = require('../utils');
const cooldown = require('../cooldown');
const { fail, userName } = require('../battle/commandUtil');

const DISPLAY = ['image', 'text', 'compact'];
const SPEED = { 0: 0, instant: 0, 1: 1, short: 1, 2: 2, lengthy: 2 };
const LOGS = { false: 0, true: 1, link: 2 };

// sbs / sbattlesetting [display|speed|logs=value]
module.exports = {
    name: 'battlesetting',
    aliases: ['bs', 'battlesettings'],
    async execute(message, args) {
        if (onCooldown(message, 'team')) return;
        cooldown.start('team', message.author.id);
        if (!args.length) return settingsView.send(message);
        const parts = args.join('').toLowerCase().split('=');
        const usage = `The correct command is \`${cfg.PREFIX}battlesetting {settingName=setting}\``;
        if (parts.length !== 2) return fail(message, usage);
        const [field, value] = parts;
        const userId = message.author.id;
        const before = await settingsDb.getRawSettings(userId);
        let key;
        if (field === 'display') {
            if (!DISPLAY.includes(value)) return fail(message, 'the display settings can only be `image`, `compact`, or `text`!');
            await settingsDb.setBattleSetting(userId, 'display', value);
            key = 'display';
        } else if (field === 'speed') {
            if (!(value in SPEED)) return fail(message, 'the speed settings can only be `instant`, `short`, or `lengthy`!');
            await settingsDb.setBattleSetting(userId, 'speed', SPEED[value]);
            key = 'speed';
        } else if (field === 'log' || field === 'logs') {
            if (!(value in LOGS)) return fail(message, 'the log settings can only be `true`, or `false`!');
            await settingsDb.setBattleSetting(userId, 'logs', LOGS[value]);
            key = 'logs';
        } else {
            return fail(message, 'the display settings can only be `logs`, `display`, or `speed`!');
        }
        const after = await settingsDb.getRawSettings(userId);
        const change = before[key] !== after[key]
            ? { by: userName(message.guild, message.author), key, from: before[key], to: after[key] }
            : null;
        return settingsView.send(message, change);
    }
};
