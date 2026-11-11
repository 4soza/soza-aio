/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 *
 * Tampilan senjata: daftar (paging tombol), detail, dan perbandingan reroll.
 */
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const cfg = require('../config');
const weaponDb = require('./weaponDb.js');
const WeaponInterface = require('./WeaponInterface.js');
const { ANIMALS } = require('../zoo/data');
const { EMBED_COLOR } = require('./battleDisplay.js');
const { SHARD_EMOJI } = require('./commandUtil.js');

const PREFIX = 'fbattle';
const PER_PAGE = 15;

const weaponIcons = (weapon) => `${weapon.rank.emoji}${weapon.emoji}${weapon.passives.map((p) => p.emoji).join('')}`;

/* Satu halaman daftar senjata + tombol prev/next. Return null kalau kosong. */
async function listMessage(userId, ownerName, { page = 0, sort = 'id', wid } = {}) {
	if (!weaponDb.SORTS[sort]) sort = 'id';
	const first = await weaponDb.listWeapons(userId, { page: 0, perPage: 1, sort, wid });
	const maxPage = Math.max(1, Math.ceil(first.total / PER_PAGE));
	if (!first.total) return null;
	if (page < 0) page = maxPage - 1;
	if (page >= maxPage) page = 0;
	const { docs, total } = await weaponDb.listWeapons(userId, { page, perPage: PER_PAGE, sort, wid });

	const lines = [];
	for (const doc of docs) {
		const weapon = weaponDb.parseWeapon(doc);
		if (!weapon) continue;
		let row = `\`${weapon.uwid}\` ${weaponIcons(weapon)} ${weapon.favorite ? '⭐ ' : ''}**${weapon.fullName}** ${weapon.avgQuality}%`;
		if (doc.animal && ANIMALS[doc.animal]) row += ` ➤ ${ANIMALS[doc.animal].uni}`;
		lines.push(row);
	}
	const p = cfg.PREFIX;
	const help = [
		`Description: \`${p}weapon {weaponID}\``,
		`Equip: \`${p}weapon {weaponID} {animal}\``,
		`Unequip: \`${p}weapon unequip {weaponID}\``,
		`Reroll: \`${p}w rr {weaponID} [passive|stat]\``,
		`Favorite: \`${p}w fav {weaponID}\``,
		`Dismantle: \`${p}dismantle {weaponID|cw,rw,uw...}\``
	].join('\n');
	const embed = {
		author: { name: `${ownerName}'s ${wid ? WeaponInterface.weapons[wid].getName : 'weapons'}` },
		description: `${help}\n\n${lines.join('\n')}`,
		color: EMBED_COLOR,
		footer: { text: `Page ${page + 1}/${maxPage} | Sorting by ${sort} | ${total} weapons` }
	};
	const id = (target) => `${PREFIX}:wp:${userId}:${sort}:${wid || 0}:${target}`;
	const components = maxPage > 1 ? [new ActionRowBuilder().addComponents(
		new ButtonBuilder().setCustomId(id(page - 1)).setEmoji('⬅️').setStyle(ButtonStyle.Primary),
		new ButtonBuilder().setCustomId(id(page + 1)).setEmoji('➡️').setStyle(ButtonStyle.Primary)
	)] : [];
	return { embeds: [embed], components };
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

module.exports = { PREFIX, PER_PAGE, listMessage, detailEmbed, describeWeapon, rerollMessage, weaponIcons, SHARD_EMOJI };
