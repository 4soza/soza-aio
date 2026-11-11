// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0 (https://github.com/ChristopherBThai/Discord-OwO-Bot)
const cfg = require('../config');
const settingsDb = require('../battle/settingsDb');
const { EMBED_COLOR } = require('../battle/battleDisplay');
const { sendEmbed, canEmbed, send, displayName, onCooldown } = require('../utils');
const cooldown = require('../cooldown');
const { fail, userName } = require('../battle/commandUtil');

async function show(message) {
    const s = await settingsDb.getBattleSetting(message.author.id);
    const text = `**Display = ** \`${s.display}\`\n**Speed = ** \`${s.speed}\`\n**Logs = ** \`${s.showLogs}\``;
    const title = `${userName(message.guild, message.author)}'s battle settings`;
    if (!canEmbed(message)) return send(message, `**${title}**\n${text}`);
    return sendEmbed(message, { color: EMBED_COLOR, author: { name: title }, description: text });
}

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
        if (!args.length) return show(message);
        const parts = args.join('').toLowerCase().split('=');
        const usage = `The correct command is \`${cfg.PREFIX}battlesetting {settingName=setting}\``;
        if (parts.length !== 2) return fail(message, usage);
        const [field, value] = parts;
        const userId = message.author.id;
        if (field === 'display') {
            if (!DISPLAY.includes(value)) return fail(message, 'the display settings can only be `image`, `compact`, or `text`!');
            await settingsDb.setBattleSetting(userId, 'display', value);
        } else if (field === 'speed') {
            if (!(value in SPEED)) return fail(message, 'the speed settings can only be `instant`, `short`, or `lengthy`!');
            await settingsDb.setBattleSetting(userId, 'speed', SPEED[value]);
        } else if (field === 'log' || field === 'logs') {
            if (!(value in LOGS)) return fail(message, 'the log settings can only be `true`, or `false`!');
            await settingsDb.setBattleSetting(userId, 'logs', LOGS[value]);
        } else {
            return fail(message, 'the display settings can only be `logs`, `display`, or `speed`!');
        }
        return show(message);
    }
};
