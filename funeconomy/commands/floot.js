// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
const emojis = require('../customEmoji');
const cooldown = require('../cooldown');
const { displayName, send, sendTemporaryError, onCooldown } = require('../utils');
const { openFabledBoxes, getFabledCount, LOOTBOX_MAX_OPEN: MAX_OPEN } = require('../zoo/lootboxDb');
const { toSmallNum, BLANK } = require('../zoo/format');

const err = (message, name, text) => sendTemporaryError(message, `**🚫 | ${name}**, ${text}`);

module.exports = {
    name: 'floot',
    aliases: ['fbox', 'fabledlootbox', 'flootbox'],
    async execute(message, args) {
        const userId = message.author.id;
        const name = displayName(message);
        const arg = (args[0] || '').toLowerCase();

        let count = 1;
        let single = true;
        if (arg === 'all') {
            const have = await getFabledCount(userId);
            if (have <= 0) return err(message, name, "you don't have any more fabled lootboxes!");
            count = Math.min(have, MAX_OPEN);
            single = false;
        } else if (/^\d+$/.test(arg)) {
            count = Math.min(parseInt(arg, 10), MAX_OPEN);
            single = false;
            if (count <= 0) return err(message, name, 'you need to open at least one silly!');
        } else if (arg) {
            return err(message, name, 'the correct command is `sfloot {count|all}`!');
        }

        if (onCooldown(message, 'lootbox')) return;
        // Cek saldo cepat dulu supaya pesan pertama langsung muncul; membuka berjalan sambil menunggu 3 detik.
        let have;
        try { have = await getFabledCount(userId); } catch (error) {
            console.error('[FUNECONOMY] lootbox failed:', error.message);
            return err(message, name, 'It looks like something went wrong...');
        }
        if (have < count) return err(message, name, "You don't have any fabled lootboxes!");
        cooldown.start('lootbox', userId);
        const first = count === 1
            ? `${BLANK} **| ${name}** opens a fabled lootbox\n**${emojis.flootShake()} |** and finds a ...`
            : `${BLANK} **| ${name}** opens ${count} fabled lootboxes\n**${emojis.flootShake()} |** and finds...`;
        const sent = await send(message, first);
        let result;
        try { [result] = await Promise.all([openFabledBoxes(userId, count), new Promise((r) => setTimeout(r, 3000))]); } catch (error) {
            console.error('[FUNECONOMY] lootbox failed:', error.message);
            return sent?.edit?.(`**🚫 | ${name}**, It looks like something went wrong...`)?.catch?.(() => {});
        }
        if (!result) return sent?.edit?.(`**🚫 | ${name}**, You don't have any fabled lootboxes!`)?.catch?.(() => {});

        const entries = Object.values(result.gems);
        let last;
        if (count === 1) {
            const gem = entries[0].gem;
            const gemName = `${gem.rankName} ${gem.type} Gem`;
            last = `**${gem.emoji} | ${name}** opens a fabled lootbox\n**${emojis.flootOpen()} |** and finds a${/^[EU]/.test(gemName) ? 'n' : ''} **${gemName}**!`;
        } else {
            const gemText = entries.map((e) => `${e.gem.emoji}${toSmallNum(e.count)}`).join(' ');
            last = `${BLANK} **| ${name}** opens ${count} fabled lootboxes\n**${emojis.flootOpen()} |** and finds: ${gemText}`;
        }
        sent?.edit?.(last)?.catch?.(() => {});
        return sent;
    }
};
