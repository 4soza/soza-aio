// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0 (https://github.com/ChristopherBThai/Discord-OwO-Bot)
// Shop pages (rings, weapon list) and the detailed daily weapon viewer, paged with buttons.
// customId: fshop:<mode>:<ownerId>:<page>:<prev|next> (suffix wajib: Discord menolak customId kembar, mis. saat total halaman = 2)   mode m = main shop (rings / weapons), w = weapon viewer.
const emojis = require('../customEmoji');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const cfg = require('../config');
const crateDb = require('../battle/crateDb');
const WeaponInterface = require('../battle/WeaponInterface');
const { EMBED_COLOR } = require('../battle/battleDisplay');

const { hms } = require('../zoo/format');
const ringShop = require('./ringShop');
const weaponShop = require('./weaponShop');

const BUTTON_PREFIX = 'fshop';
const CHAR_LEN = 30;
const MAIN_PAGES = 2; // 1 = rings, 2 = weapons + crate
const CART = '🛒';

/* One shop row (OwO PageClass.toItem). */
function toItem({ id, emoji, name, price, priceEmoji, lineThrough, offset }) {
    let dashes = CHAR_LEN - name.length + (4 - String(price).length);
    if (offset) dashes += offset;
    if (dashes < 0) dashes = 0;
    const row = `\`${id}\` ${emoji} **\`${name}\`**\`${'-'.repeat(dashes)} ${price}\` ${priceEmoji}`;
    return lineThrough ? `~~${row}~~\n` : `${row}\n`;
}

const weaponIcons = (weapon) => weapon.emoji + weapon.passives.map((p) => p.emoji).join('');

function weaponName(weapon) {
    let name = `${weapon.rank.name} ${weapon.name}`;
    if (weapon.wear?.buff) name = `[${weapon.wearName.charAt(0)}] ${name}`;
    if (weapon.hasTakedownTracker) name = `*${name}`;
    return name;
}

function ringPage() {
    const p = cfg.PREFIX;
    let result = '';
    for (const ring of Object.values(ringShop.RINGS)) {
        result += toItem({
            id: ring.id, emoji: ring.emoji, name: ring.name,
            price: ringShop.toShortNum(ring.price), priceEmoji: cfg.CASH_EMOJI
        });
    }
    return {
        title: 'OwO Shop: Rings',
        description: 'Purchase a ring to propose to someone!\nAll rings are the same. Different tiers are available to show off your love!\n'
            + `- **\`${p}buy {id}\`** to buy an item\n- **\`${p}sell {id}\`** to sell an item for 75% of its original price\n`
            + `- **\`${p}marry @user {id}\`** to use the ring\n${'═'.repeat(CHAR_LEN + 2)}\n${result}`
    };
}

function weaponListPage(offers) {
    const p = cfg.PREFIX;
    let result = toItem({
        id: weaponShop.CRATE_ID, name: 'Weapon Crate', emoji: emojis.crate(),
        price: weaponShop.CRATE_PRICE, priceEmoji: emojis.shard()
    });
    for (const offer of offers) {
        result += toItem({
            id: offer.shopId, name: weaponName(offer.weapon), emoji: weaponIcons(offer.weapon),
            price: offer.price, priceEmoji: emojis.shard(), lineThrough: offer.purchased,
            offset: offer.weapon.passives.length * -3
        });
    }
    return {
        title: 'OwO Shop: Weapons',
        description: 'Use your Weapon Shards to purchase weapons and crates!\nWeapons are randomly generated every day!\n'
            + `- **\`${p}buy {id}\`** to buy a weapon\n- **\`${p}shop weapon\`** to view the weapons\n${'═'.repeat(CHAR_LEN + 2)}\n${result}`,
        resets: true
    };
}

/* Detailed view of one daily weapon (OwO dailyWeaponUtil.createEmbed). */
function weaponDetailPage(offer) {
    const { weapon } = offer;
    let desc = `**Name:** ${weapon.name}\n**Shop ID:** ${offer.shopId}\n`;
    desc += offer.purchased ? '**Price:** PURCHASED\n\n' : `**Price:** ${offer.price} ${emojis.shard()}\n\n`;
    desc += `**Quality:** ${weapon.rank.emoji} ${weapon.avgQuality}%\n**Wear:** \`${String(weapon.wearName).toUpperCase()}\`\n`;
    if (weapon.hasTakedownTracker) desc += '**Takedown Tracker:** `TRUE`\n';
    desc += `**WP Cost:** ${Math.ceil(weapon.manaCost)} ${WeaponInterface.wpEmoji}`;
    desc += `\n**Description:** ${weapon.desc}\n`;
    if (weapon.buffList.length > 0) {
        desc += '\n';
        for (const buff of weapon.getBuffs()) desc += `${buff.emoji} **${buff.name}** - ${buff.desc}\n`;
    }
    if (weapon.passives.length <= 0) desc += '\n**Passives:** None';
    for (const passive of weapon.passives) desc += `\n${passive.emoji} **${passive.name}** - ${passive.desc}`;
    return { title: "Today's Available Weapons", description: desc, resets: true };
}

const buttonsFor = (mode, ownerId, page, total) => [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${BUTTON_PREFIX}:${mode}:${ownerId}:${page <= 1 ? total : page - 1}:prev`).setEmoji('⬅️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`${BUTTON_PREFIX}:${mode}:${ownerId}:${page >= total ? 1 : page + 1}:next`).setEmoji('➡️').setStyle(ButtonStyle.Primary)
)];

/*
 * Build one shop page. mode 'm' (main: 1 rings, 2 weapons) or 'w' (weapon viewer: one weapon per page).
 * Return { embeds, components, page, total, plain } (plain = text fallback when embeds are not allowed).
 */
async function buildPage(ownerId, mode, page, { avatarUrl, now = Date.now() } = {}) {
    const needsOffers = mode === 'w' || page === 2;
    const offers = needsOffers ? await weaponShop.getDailyWeapons(ownerId, now) : [];
    const total = mode === 'w' ? offers.length : MAIN_PAGES;
    page = Math.min(Math.max(1, page || 1), total);

    let content;
    if (mode === 'w') content = weaponDetailPage(offers[page - 1]);
    else content = page === 1 ? ringPage() : weaponListPage(offers);

    let footer = `Page ${page}/${total}`;
    if (content.resets) footer += ` | Resets in: ${hms(crateDb.msUntilReset(now))}`;
    const embed = {
        author: { name: content.title, ...(avatarUrl ? { icon_url: avatarUrl } : {}) },
        description: content.description,
        color: EMBED_COLOR,
        footer: { text: footer }
    };
    return {
        embeds: [embed], components: buttonsFor(mode, ownerId, page, total), page, total,
        plain: `**${content.title}**\n${content.description}\n${footer}`
    };
}

async function handleButton(interaction) {
    const [, mode, ownerId, pageText] = interaction.customId.split(':');
    if (interaction.user.id !== ownerId) {
        return interaction.reply({ content: "This isn't your shop!", flags: MessageFlags.Ephemeral });
    }
    if (mode !== 'm' && mode !== 'w') return null;
    try {
        const built = await buildPage(ownerId, mode, parseInt(pageText, 10) || 1, { avatarUrl: interaction.user.displayAvatarURL?.() });
        return await interaction.update({ embeds: built.embeds, components: built.components });
    } catch (error) {
        console.error('[SHOP] button failed:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'Something went wrong... Try again!', flags: MessageFlags.Ephemeral }).catch(() => {});
        }
        return null;
    }
}

module.exports = { BUTTON_PREFIX, CART, MAIN_PAGES, toItem, buildPage, handleButton };
