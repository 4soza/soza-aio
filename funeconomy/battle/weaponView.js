/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 *
 * Tampilan senjata: daftar (paging tombol), detail, dan perbandingan reroll.
 */
const emojis = require('../customEmoji');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const cfg = require('../config');
const weaponDb = require('./weaponDb.js');
const WeaponInterface = require('./WeaponInterface.js');
const { ANIMALS } = require('../zoo/data');
const { EMBED_COLOR } = require('./battleDisplay.js');
const { EXPIRED_COLOR } = require('../gameExpiry');
const path = require('path');
const fs = require('fs');


const PREFIX = 'fbattle';
const PER_PAGE = 15;

const weaponIcons = (weapon) => `${weapon.rank.emoji}${weapon.emoji}${weapon.passives.map((p) => p.emoji).join('')}`;

const SORT_LABELS = {
	id: 'Weapon ID', rarity: 'Rarity', type: 'Type', equipped: 'Equipped', favorite: 'Favorite', tt: 'Kills', wear: 'Wear'
};
const RANK_NAMES = WeaponInterface.ranks.map((r) => r[1]);
const V2 = 32768; // MessageFlags.IsComponentsV2

const text = (content) => ({ type: 10, content });
const separator = () => ({ type: 14, divider: true, spacing: 1 });
const button = (customId, { label, emoji, style = 2, disabled = false } = {}) => ({
	type: 2, custom_id: customId, style, disabled, ...(label ? { label } : {}), ...(emoji ? { emoji: { name: emoji } } : {})
});

/* Bagian customId yang menyimpan keadaan daftar: <owner>:<sort>:<wid>:<rank|x> */
const stateId = (userId, sort, wid, rank) => `${userId}:${sort}:${wid || 0}:${rank === undefined ? 'x' : rank}`;

/*
 * Daftar senjata seperti OwO: judul + tombol "?", filter rarity, pilihan sort, daftar, lalu tombol halaman.
 * Pesan memakai Components V2 (container). Return null kalau kosong.
 * customId: fbattle:wp:<state>:<page>:<first|prev|next|last|now>, fbattle:wpf:<state> (filter), fbattle:wps:<owner>:<wid>:<rank> (sort),
 * fbattle:wph:<owner> (bantuan).
 */
async function listMessage(userId, ownerName, { page = 0, sort = 'id', wid, rank, expired = false } = {}) {
	if (!weaponDb.SORTS[sort]) sort = 'id';
	const first = await weaponDb.listWeapons(userId, { page: 0, perPage: 1, sort, wid, rank });
	const maxPage = Math.max(1, Math.ceil(first.total / PER_PAGE));
	if (!first.total && rank === undefined) return null;
	if (page < 0) page = maxPage - 1;
	if (page >= maxPage) page = 0;
	const { docs, total } = await weaponDb.listWeapons(userId, { page, perPage: PER_PAGE, sort, wid, rank });

	const lines = [];
	for (const doc of docs) {
		const weapon = weaponDb.parseWeapon(doc);
		if (!weapon) continue;
		let row = `\`${weapon.uwid}\` ${weaponIcons(weapon)} ${weapon.favorite ? '⭐ ' : ''}**${weapon.fullName}** ${weapon.avgQuality}%`;
		if (doc.animal && ANIMALS[doc.animal]) row += ` ➤ ${ANIMALS[doc.animal].uni}`;
		lines.push(row);
	}
	const id = stateId(userId, sort, wid, rank);
	const filterName = rank === undefined ? 'None' : RANK_NAMES[rank];
	const title = `### 🗡️ **${ownerName}**'s ${wid ? WeaponInterface.weapons[wid].getName : 'Weapons'}`;
	const nav = (act, emoji, target) => button(`fbattle:wp:${id}:${target}:${act}`, { emoji, disabled: expired || maxPage <= 1 });
	const components = [
		{ type: 9, components: [text(title)], accessory: button(`fbattle:wph:${userId}`, { label: '?', disabled: expired }) },
		{
			type: 9,
			components: [text(`**Weapon Filters:** \`${filterName}\``)],
			accessory: button(`fbattle:wpf:${id}`, { label: 'Filter', emoji: '🔻', disabled: expired })
		},
		{
			type: 1,
			components: [{
				type: 3, custom_id: `fbattle:wps:${userId}:${wid || 0}:${rank === undefined ? 'x' : rank}`, disabled: expired,
				placeholder: `Sort by ${SORT_LABELS[sort]}`,
				options: Object.keys(SORT_LABELS).map((key) => ({ label: `Sort by ${SORT_LABELS[key]}`, value: key, default: key === sort }))
			}]
		},
		separator(),
		text(lines.length ? lines.join('\n') : '*No weapons found with this filter.*'),
		separator(),
		{
			type: 1,
			components: [
				nav('first', '⏪', 0),
				nav('prev', '◀️', page),
				button(`fbattle:wp:${id}:${page}:now`, { label: `${page + 1}/${maxPage}`, disabled: true }),
				nav('next', '▶️', page),
				nav('last', '⏩', page)
			]
		}
	];
	return {
		components: [{ type: 17, accent_color: expired ? EXPIRED_COLOR : EMBED_COLOR, components }],
		flags: V2
	};
}

/* Teks bantuan (tombol "?") */
function helpText() {
	const p = cfg.PREFIX;
	return [
		`Description: \`${p}weapon {weaponID}\``,
		`Equip: \`${p}weapon {weaponID} {animal}\``,
		`Unequip: \`${p}weapon unequip {weaponID}\``,
		`Reroll: \`${p}w rr {weaponID} [passive|stat]\``,
		`Favorite: \`${p}w fav {weaponID}\``,
		`Dismantle: \`${p}dismantle {weaponID|cw,rw,uw...}\``
	].join('\n');
}

/* Deskripsi lengkap satu senjata */
function describeWeapon(weapon, { footer } = {}) {
	let desc = `**Name:** ${weapon.name}\n`;
	desc += `**ID:** \`${weapon.uwid}\`\n`;
	desc += `**Sell Value:** ${weapon.unsellable ? 'UNSELLABLE' : weaponDb.SELL_PRICES[weapon.rank.name]}\n`;
	desc += `**Quality:** ${weapon.rank.emoji} ${weapon.avgQuality}%\n`;
	desc += `**Wear:** \`${weapon.wearName?.toUpperCase()}\`\n`;
	if (weapon.hasTakedownTracker) desc += `**Kills:** \`${Number(weapon.kills).toLocaleString('en-US')}\`\n`;
	desc += `**WP Cost:** ${Math.ceil(weapon.manaCost)} ${WeaponInterface.wpEmoji}`;
	desc += `\n**Description:** ${weapon.desc}\n`;
	if (weapon.buffList.length > 0) {
		desc += '\n';
		for (const buff of weapon.getBuffs()) desc += `${buff.emoji} **${buff.name}** - ${buff.desc}\n`;
	}
	if (weapon.passives.length <= 0) desc += '\n**Passives:** None';
	for (const passive of weapon.passives) desc += `\n${passive.emoji} **${passive.name}** - ${passive.desc}`;
	return { description: desc, footer };
}

function detailEmbed(weapon, ownerName, animalKey) {
	const base = describeWeapon(weapon, { footer: { text: `Reroll Changes: ${weapon.rrCount} | Reroll Attempts: ${weapon.rrAttempt}` } });
	let description = base.description;
	if (animalKey && ANIMALS[animalKey]) description = `**Wielded by:** ${ANIMALS[animalKey].uni} ${ANIMALS[animalKey].name}\n${description}`;
	if (weapon.favorite) description = `⭐ **Favorite**\n${description}`;
	return {
		author: { name: `${ownerName}'s ${weapon.fullName}` },
		color: EMBED_COLOR, description, footer: base.footer
	};
}

function rerollField(title, weapon) {
	const d = describeWeapon(weapon).description.replace(/\*\*Sell Value:\*\*.*\n/, '').replace(/\*\*Name:\*\*.*\n/, '');
	return { name: `${weapon.emoji} **${title}** ${weapon.fullName}`.slice(0, 256), value: d.slice(0, 1024) };
}

/* Perbandingan reroll (CURRENT vs NEW) + tombol konfirmasi */
function rerollMessage(ownerId, ownerName, oldWeapon, newWeapon, { disabled = false, color = EMBED_COLOR, note } = {}) {
	const embed = {
		author: { name: `${ownerName} spent ${weaponDb.REROLL_PRICE} Weapon Shards to reroll!` },
		color,
		footer: { text: `Reroll Changes: ${newWeapon.rrCount} | Reroll Attempts: ${newWeapon.rrAttempt}` },
		fields: [rerollField('[CURRENT]', oldWeapon), rerollField('[NEW]', newWeapon)]
	};
	if (oldWeapon.wear.id !== newWeapon.wear.id) {
		embed.description = `⚠️ Your wear will change from \`${oldWeapon.wearName}\` to \`${newWeapon.wearName}\` ⚠️`;
	}
	const id = (action) => `${PREFIX}:rr:${action}:${ownerId}:${oldWeapon.ruwid}`;
	const row = new ActionRowBuilder().addComponents(
		new ButtonBuilder().setCustomId(id('confirm')).setLabel('Confirm').setEmoji('✅').setStyle(ButtonStyle.Success).setDisabled(disabled),
		new ButtonBuilder().setCustomId(id('cancel')).setLabel('Cancel').setEmoji('❎').setStyle(ButtonStyle.Danger).setDisabled(disabled),
		new ButtonBuilder().setCustomId(id('again')).setLabel('Reroll').setEmoji('🔄').setStyle(ButtonStyle.Secondary).setDisabled(disabled)
	);
	return { content: note || '', embeds: [embed], components: [row] };
}

/*
 * Konfirmasi jual semua senjata satu rank (`ssell uw`). Gambar kanan atas = assets/sell.png (kalau ada).
 * customId: fbattle:sw:<sell|cancel>:<owner>:<rankIndex>
 */
const SELL_IMAGE = path.join(__dirname, '..', '..', 'assets', 'sell.png');
const SELL_IMAGE_NAME = 'sell.png';
const hasSellImage = () => { try { return fs.existsSync(SELL_IMAGE); } catch { return false; } };

function sellMessage(ownerId, rankIndex, weapons, { disabled = false, color = EMBED_COLOR, result, withFile = true } = {}) {
	const rankName = RANK_NAMES[rankIndex];
	const rankEmoji = weapons[0]?.rank?.emoji || WeaponInterface.ranks[rankIndex][2] || '';
	const price = weapons.length * weaponDb.SELL_PRICES[rankName];
	const shown = weapons.slice(0, 5).map((w) => `${w.emoji} \`${w.uwid}\` \`${w.avgQuality}%\` ${w.name}`);
	let description;
	if (result) description = result;
	else {
		description = `Are you sure you want to sell **${weapons.length}** ${rankEmoji} ${rankName} weapons for **${price.toLocaleString('en-US')}** ${cfg.CASH_EMOJI}?\n\n${shown.join('\n')}`;
		if (weapons.length > shown.length) description += `\n...and **${weapons.length - shown.length}** more weapons`;
	}
	const embed = { color, description };
	const files = [];
	if (hasSellImage()) {
		embed.thumbnail = { url: `attachment://${SELL_IMAGE_NAME}` };
		if (withFile) files.push({ attachment: SELL_IMAGE, name: SELL_IMAGE_NAME });
	}
	const id = (action) => `${PREFIX}:sw:${action}:${ownerId}:${rankIndex}`;
	const row = new ActionRowBuilder().addComponents(
		new ButtonBuilder().setCustomId(id('sell')).setLabel('Sell').setEmoji('✅').setStyle(ButtonStyle.Success).setDisabled(disabled),
		new ButtonBuilder().setCustomId(id('cancel')).setLabel('Cancel').setEmoji('❎').setStyle(ButtonStyle.Danger).setDisabled(disabled)
	);
	return { embeds: [embed], components: [row], ...(files.length ? { files } : {}) };
}

module.exports = { sellMessage, PREFIX, PER_PAGE, listMessage, helpText, RANK_NAMES, SORT_LABELS, detailEmbed, describeWeapon, rerollMessage, weaponIcons };
		
