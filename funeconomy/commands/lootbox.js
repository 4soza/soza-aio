// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
const emojis = require('../customEmoji');
const cooldown = require('../cooldown');
const { displayName, send, sendTemporaryError, onCooldown } = require('../utils');
const { openBoxes, getBoxCount, MAX_OPEN } = require('../zoo/lootboxDb');
const { toSmallNum, BLANK } = require('../zoo/format');

const err = (message, name, text) => sendTemporaryError(message, `**🚫 | ${name}**, ${text}`);

module.exports = {
    name: 'lootbox',
    aliases: ['box', 'lootboxes'],
    async execute(message, args) {
        const userId = message.author.id;
        const name = displayName(message);
        const arg = (args[0] || '').toLowerCase();

        let count = 1;
        let single = true;
        if (arg === 'all') {
            const have = await getBoxCount(userId);
            if (have <= 0) return err(message, name, "you don't have any more lootboxes!");
            count = Math.min(have, MAX_OPEN);
            single = false;
        } else if (/^\d+$/.test(arg)) {
            count = Math.min(parseInt(arg, 10), MAX_OPEN);
            single = false;
            if (count <= 0) return err(message, name, 'you need to open at least one silly!');
        } else if (arg) {
            return err(message, name, 'the correct command is `slootbox {count|all}`!');
        }

        if (onCooldown(message, 'lootbox')) return;
        cooldown.start('lootbox', userId);

        let result;
        try { result = await openBoxes(userId, count); } catch (error) {
            console.error('[FUNECONOMY] lootbox failed:', error.message);
            return err(message, name, 'It looks like something went wrong...');
        }
        if (!result) return err(message, name, "You don't have any lootboxes!");

        const entries = Object.values(result.gems);
        let first;
        let last;
        if (count === 1) {
            const gem = entries[0].gem;
            const gemName = `${gem.rankName} ${gem.type} Gem`;
            first = `**${emojis.lootbox()} | ${name}** opens a lootbox\n**🎁 |** and finds a ...`;
            last = `**${gem.emoji} | ${name}** opens a lootbox\n**🎁 |** and finds a${/^[EU]/.test(gemName) ? 'n' : ''} **${gemName}**!`;
        } else {
            const gemText = entries.map((e) => `${e.gem.emoji}${toSmallNum(e.count)}`).join(' ');
            first = `${BLANK} **| ${name}** opens ${count} lootboxes\n**🎁 |** and finds...`;
            last = `${BLANK} **| ${name}** opens ${count} lootboxes\n**🎁 |** and finds: ${gemText}`;
        }
        const sent = await send(message, first);
        const timer = setTimeout(() => { sent.edit?.(last)?.catch?.(() => {}); }, 3000);
        timer.unref?.();
        return sent;
    }
};
