// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0 (https://github.com/ChristopherBThai/Discord-OwO-Bot)
const cfg = require('../config');
const teamUtil = require('../battle/teamUtil');
const challengeDb = require('../battle/challengeDb');
const { teamPage } = require('../battle/teamView');
const { track } = require('../inactivity');
const { send, onCooldown } = require('../utils');
const cooldown = require('../cooldown');
const { fail, userName, isInt } = require('../battle/commandUtil');

// ssetteam [number] = lihat semua team / pilih team aktif
module.exports = {
    name: 'teams',
    aliases: ['setteam', 'squads', 'useteams'],
    async execute(message, args) {
        if (args.length && !isInt(args[0])) return fail(message, `the correct syntax is \`${cfg.PREFIX}setteam {teamNumber}\``, 3000);
        if (onCooldown(message, 'team')) return;
        const userId = message.author.id;
        if (args.length) {
            const number = parseInt(args[0], 10);
            if (number < 1 || number > teamUtil.MAX_TEAMS) return fail(message, 'invalid team number!', 3000);
            if (await challengeDb.inBattle(userId)) {
                return fail(message, `You cannot change your team while you have a pending battle! Use \`${cfg.PREFIX}db\` to decline`, 3000);
            }
            await teamUtil.setActive(userId, number);
        }
        cooldown.start('team', userId);
        const doc = await teamUtil.getTeamDoc(userId);
        const page = await teamPage(userId, userName(message.guild, message.author),
            message.author.displayAvatarURL?.({ extension: 'png', size: 128 }), doc?.active || 0);
        if (!page) return fail(message, `you don't have a team! Create one with \`${cfg.PREFIX}team add {animalName}\`!`, 5000);
        return track(await message.channel.send({ ...page, allowedMentions: { parse: [] } }));
    }
};
