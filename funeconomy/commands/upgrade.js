// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
const cooldown = require('../cooldown');
const { fmt, displayName, send, sendTemporaryError, onCooldown } = require('../utils');
const HuntBot = require('../zoo/huntbot');
const { BLANK } = require('../zoo/format');

const ESSENCE = '✨';
const err = (message, name, text) => sendTemporaryError(message, `**🚫 | ${name}**, ${text}`);

module.exports = {
    name: 'upgrade',
    aliases: ['upg'],
    async execute(message, args) {
        const userId = message.author.id;
        const name = displayName(message);
        const isInt = (t) => /^\d+$/.test(t || '');
        let traitWord; let mode;
        if (isInt(args[0])) { traitWord = args[1]; mode = { count: parseInt(args[0], 10) }; }
        else if (isInt(args[1])) { traitWord = args[0]; mode = { count: parseInt(args[1], 10) }; }
        else if ((args[1] || '').toLowerCase() === 'all') { traitWord = args[0]; mode = { all: true }; }
        else if (['lvl', 'level'].includes((args[1] || '').toLowerCase())) { traitWord = args[0]; mode = { level: true }; }
        else return err(message, name, 'Please include how many animal essence to use!');

        const trait = HuntBot.TRAIT_ALIASES[String(traitWord || '').toLowerCase()];
        if (!trait) {
            return send(message, `**🚫 | ${name}**, I could not find that autohunt trait!\n${BLANK} **|** You can choose from: \`efficiency\`, \`duration\`, \`cost\`, \`gain\`, \`exp\`, or \`radar\``);
        }
        if (mode.count !== undefined && mode.count <= 0) return err(message, name, 'You need to use more than 1 animal essence silly~');

        if (onCooldown(message, 'autohunt')) return;
        cooldown.start('autohunt', userId);

        const result = await HuntBot.upgrade(userId, trait, mode);
        if (result.error === 'max') return err(message, name, 'this trait is already maxed out!');
        if (result.error === 'busy') return err(message, name, 'there was an error upgrading! Please try again.');
        if (result.error) return err(message, name, 'You do not have enough animal essence!');

        const { stat, spent } = result;
        let text = `**🛠 | ${name}**, You successfully upgraded \`${trait}\` with **${fmt(spent)} Animal Essence** ${ESSENCE}!`;
        text += `\n${BLANK} **|** \`${trait}: ${stat.stat + stat.prefix} -  Lvl ${stat.lvl} ${stat.max ? '[MAX]' : `[${stat.currentxp}/${stat.maxxp}]`}\``;
        if (stat.max) text += `\n${BLANK} **|** HuntBot is at max level!`;
        else if (stat.lvlup) text += `\n${BLANK} **|** HuntBot Leveled Up!! 🎉`;
        return send(message, text);
    }
};
