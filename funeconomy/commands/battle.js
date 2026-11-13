// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0 (https://github.com/ChristopherBThai/Discord-OwO-Bot)
const emojis = require('../customEmoji');
const cfg = require('../config');
const cooldown = require('../cooldown');
const teamUtil = require('../battle/teamUtil');
const settingsDb = require('../battle/settingsDb');
const BattleEvent = require('../battle/battleEvent');
const friend = require('../battle/battleFriend');
const { displayBattle } = require('../battle/battleDisplay');
const { displayName, send, onCooldown } = require('../utils');
const { fail, userName, resolveUser, isUserToken } = require('../battle/commandUtil');
const { trackFor } = require('../quests/questTrack');

// Satu battle per user pada satu waktu
const running = new Set();

module.exports = {
    name: 'battle',
    aliases: ['b', 'fight'],
    async execute(message, args, client) {
        const userId = message.author.id;
        const name = displayName(message);

        // Battle teman: sbattle @user [flags]
        if (args[0] && isUserToken(args[0])) {
            const opponent = await resolveUser(message, args[0], client);
            if (!opponent) return fail(message, 'That is not a valid id!', 3000);
            if (onCooldown(message, 'battle')) return;
            const error = await friend.challenge(message, opponent, args.slice(1).filter((a) => !/^\d+$/.test(a)));
            if (error) return fail(message, error, 4000);
            cooldown.start('battle', userId);
            return;
        }

        if (running.has(userId)) return;
        running.add(userId);
        try {
            const player = await teamUtil.getBattleTeam(userId);
            if (!player) return fail(message, `Create a team with the command \`${cfg.PREFIX}team add {animal}\``, 5000);
            if (onCooldown(message, 'battle')) return;

            const setting = await settingsDb.getBattleSetting(userId);
            const enemy = teamUtil.generateEnemyTeam(player);
            const event = new BattleEvent({ playerName: name, enemyName: 'Enemy' });
            event.init(player, enemy);
            event.simulateBattle();
            cooldown.start('battle', userId);
            const { crate } = await event.distributeRewards({ userId });
            trackFor(message, 'battle');
            if (crate?.found) trackFor(message, 'crate');

            await displayBattle(event, setting, (embed, files) => message.channel.send({ embeds: [embed], files, allowedMentions: { parse: [] } }),
                { title: `${userName(message.guild, message.author)} goes into battle!`, iconURL: message.author.displayAvatarURL?.({ extension: 'png', size: 64 }) });

            if (crate?.found) {
                const h = Math.floor(crate.resetsIn / 3600000);
                const m = Math.floor((crate.resetsIn % 3600000) / 60000);
                const s = Math.floor((crate.resetsIn % 60000) / 1000);
                await send(message, `${emojis.crate()} | **${name}**, You found a **weapon crate**! \`[${crate.count}/3] RESETS IN: ${h}H ${m}M ${s}S\``);
            }
        } finally {
            running.delete(userId);
        }
    }
};
