// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
const emojis = require('../customEmoji');
const cooldown = require('../cooldown');
const { displayName, send, sendTemporaryError, onCooldown } = require('../utils');
const Gems = require('../zoo/gems');
const LootboxDb = require('../zoo/lootboxDb');
const { toSmallNum, BLANK } = require('../zoo/format');

const err = (message, name, text) => sendTemporaryError(message, `**🚫 | ${name}**, ${text}`);

async function showInventory(message, name) {
    const userId = message.author.id;
    const inv = await Gems.getInventory(userId);
    const boxes = await LootboxDb.getBoxCount(userId);
    const items = [];
    if (boxes > 0) items.push(`\`50\`${emojis.lootbox()}${toSmallNum(boxes)}`);
    const owned = Object.values(Gems.GEMS).filter((g) => inv.gems[g.key] > 0).sort((a, b) => a.id - b.id);
    for (const g of owned) items.push(`\`${g.id}\`${g.emoji}${toSmallNum(inv.gems[g.key])}`);
    const active = Gems.activeOf(inv);
    let text = `**======== ${name}'s Inventory ========**\n`;
    text += items.length ? items.join(' ') : '*Your inventory is empty. Hunt for lootboxes!*';
    const activeText = Object.values(active).map((a) => `${a.gem.emoji}\`[${a.left}/${a.gem.length}]\``).join(' ');
    if (activeText) text += `\n**Active gems:** ${activeText}`;
    text += '\n*Use `sgem {id}` to activate gems and `slootbox` to open lootboxes.*';
    return send(message, text);
}

async function useGems(message, name, ids) {
    const userId = message.author.id;
    if (ids.length > Gems.TYPE_ORDER.length) return err(message, name, `you can only use up to ${Gems.TYPE_ORDER.length} gems at one time!`);
    const gems = [];
    const seen = {};
    const invalid = [];
    for (const id of ids) {
        const gem = /^\d+$/.test(id) ? Gems.getGemById(id) : null;
        if (!gem) invalid.push(id);
        else if (seen[gem.type]) return err(message, name, `you can not use multiple **${gem.type} Gems** at the same time!`);
        else { seen[gem.type] = true; gems.push(gem); }
    }
    if (invalid.length) {
        const hint = invalid.includes('50') ? ' (use `slootbox` to open lootboxes)' : '';
        return err(message, name, `one or more ids are not valid gems: ${invalid.join(', ')}${hint}`);
    }

    const results = [];
    for (const gem of gems) results.push(await Gems.activate(userId, gem));
    const fail = '**🚫 |** you already have an active {t} gem or you do not own this gem!';

    if (gems.length === 1) {
        const gem = gems[0];
        if (!results[0]) return send(message, `**🚫 | ${name}**, you already have an active ${gem.type} gem or you do not own this gem!`);
        return send(message, `**${gem.emoji} | ${name}**, you activated a(n) **${gem.rankName} ${gem.type} Gem**!\n${BLANK} **|** ${Gems.describeUse(gem)}`);
    }
    let text = `**✨ | ${name}**, you activated the following gems:`;
    gems.forEach((gem, i) => {
        text += results[i]
            ? `\n**${gem.emoji} |** A(n) **${gem.rankName} ${gem.type} Gem!**\n${BLANK} **|** ${Gems.describeUse(gem)}`
            : `\n${fail.replace('{t}', gem.type)}`;
    });
    return send(message, text);
}

module.exports = {
    name: 'gem',
    aliases: ['gems', 'use'],
    async execute(message, args) {
        const name = displayName(message);
        if (onCooldown(message, 'gem')) return;
        cooldown.start('gem', message.author.id);
        if (!args.length) return showInventory(message, name);
        return useGems(message, name, args);
    }
};
