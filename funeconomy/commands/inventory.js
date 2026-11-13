// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0 (https://github.com/ChristopherBThai/Discord-OwO-Bot)
const emojis = require('../customEmoji');
const cooldown = require('../cooldown');
const { displayName, send, onCooldown } = require('../utils');
const Gems = require('../zoo/gems');
const LootboxDb = require('../zoo/lootboxDb');
const crateDb = require('../battle/crateDb');
const weaponDb = require('../battle/weaponDb');
const WeaponInterface = require('../battle/WeaponInterface');
const ringShop = require('../shop/ringShop');

const { toSmallNum } = require('../zoo/format');

const LOOTBOX_ID = 50;
const CRATE_ID = 100;

/* All inventory entries [{ id, emoji, count }] from every source, unsorted. */
async function collectItems(userId) {
    const [rings, boxes, gemInv, crate, byType] = await Promise.all([
        ringShop.getItems(userId), LootboxDb.getBoxCount(userId), Gems.getInventory(userId),
        crateDb.getCrate(userId), weaponDb.countByType(userId)
    ]);
    const items = [...rings];
    if (boxes > 0) items.push({ id: LOOTBOX_ID, emoji: emojis.lootbox(), count: boxes });
    for (const gem of Object.values(Gems.GEMS)) {
        if (gemInv.gems[gem.key] > 0) items.push({ id: gem.id, emoji: gem.emoji, count: gemInv.gems[gem.key] });
    }
    if (crate.boxcount > 0) items.push({ id: CRATE_ID, emoji: emojis.crate(), count: crate.boxcount });
    for (const { wid, count } of byType) {
        const WeaponClass = WeaponInterface.weapons[wid];
        if (WeaponClass && count > 0) {
            // Ikon tanpa bingkai (wi_) kalau ada, lalu ikon biasa (w_), lalu emoji bawaan.
            const emoji = emojis.gear('wi', WeaponClass.name, wid) || emojis.gear('w', WeaponClass.name, wid) || WeaponClass.getEmoji;
            items.push({ id: wid + 100, emoji, count });
        }
    }
    return items;
}

/* OwO addToString: id-sorted 4-column grid. */
function formatItems(items) {
    items = [...items].sort((a, b) => a.id - b.id);
    const digits = String(items.reduce((max, i) => Math.max(max, i.count), 0)).length;
    let text = '';
    let column = 0;
    for (const item of items) {
        text += `\`${String(item.id).padStart(3, '0')}\`${item.emoji}${toSmallNum(item.count, digits)}`;
        column += 1;
        if (column === 4) { text += '\n'; column = 0; } else text += '    ';
    }
    return text.trimEnd();
}

module.exports = {
    name: 'inventory',
    aliases: ['inv'],
    collectItems,
    formatItems,
    async execute(message) {
        if (onCooldown(message, 'inventory')) return;
        cooldown.start('inventory', message.author.id);
        const inv = formatItems(await collectItems(message.author.id));
        if (!inv) return send(message, 'Your inventory is empty :c');
        return send(message, `**====== ${displayName(message)}'s Inventory ======**\n${inv}`);
    }
};
