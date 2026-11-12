/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 *
 * Satu pintu untuk semua tombol battle/weapon (customId diawali "fbattle:"):
 *   fbattle:accept|decline:<senderId>:<receiverId>   battle teman
 *   fbattle:wp|wpf|wps|wph:...                         daftar senjata (halaman, filter, sort, bantuan)
 *   fbattle:rr:<confirm|cancel|again>:<ownerId>:<uwid> reroll senjata
 */
const emojis = require('../customEmoji');
const { MessageFlags } = require('discord.js');
const friend = require('./battleFriend.js');
const weaponDb = require('./weaponDb.js');
const weaponView = require('./weaponView.js');
const { userName } = require('./commandUtil.js');

const BUTTON_PREFIX = friend.BUTTON_PREFIX;
const ephemeral = (interaction, content) => interaction.reply({ content, flags: MessageFlags.Ephemeral });

const parseRank = (text) => (text === 'x' || text === undefined ? undefined : parseInt(text, 10));
const parseWid = (text) => parseInt(text, 10) || undefined;

async function refreshWeaponList(interaction, ownerId, options) {
	const message = await weaponView.listMessage(ownerId, userName(interaction.guild, interaction.user), options);
	if (!message) return interaction.update({ components: [] });
	return interaction.update({ components: message.components, flags: message.flags });
}

/* fbattle:wp:<owner>:<sort>:<wid>:<rank>:<page>:<act> */
async function handleWeaponPage(interaction, parts) {
	const [, , ownerId, sort, wid, rank, pageText, act] = parts;
	if (interaction.user.id !== ownerId) return ephemeral(interaction, "This isn't your weapon list!");
	const current = parseInt(pageText, 10) || 0;
	const page = { first: 0, prev: current - 1, next: current + 1, last: -1 }[act] ?? current;
	return refreshWeaponList(interaction, ownerId, { page, sort, wid: parseWid(wid), rank: parseRank(rank) });
}

/* fbattle:wpf:<owner>:<sort>:<wid>:<rank>  - filter rarity berganti: None > Common > ... > Fabled > None */
async function handleWeaponFilter(interaction, parts) {
	const [, , ownerId, sort, wid, rank] = parts;
	if (interaction.user.id !== ownerId) return ephemeral(interaction, "This isn't your weapon list!");
	const current = parseRank(rank);
	const next = current === undefined ? 0 : (current + 1 >= weaponView.RANK_NAMES.length ? undefined : current + 1);
	return refreshWeaponList(interaction, ownerId, { page: 0, sort, wid: parseWid(wid), rank: next });
}

/* fbattle:wps:<owner>:<wid>:<rank>  - select menu urutan */
async function handleWeaponSort(interaction, parts) {
	const [, , ownerId, wid, rank] = parts;
	if (interaction.user.id !== ownerId) return ephemeral(interaction, "This isn't your weapon list!");
	return refreshWeaponList(interaction, ownerId, { page: 0, sort: interaction.values?.[0], wid: parseWid(wid), rank: parseRank(rank) });
}

async function handleWeaponHelp(interaction, parts) {
	if (interaction.user.id !== parts[2]) return ephemeral(interaction, "This isn't your weapon list!");
	return ephemeral(interaction, weaponView.helpText());
}

async function handleReroll(interaction, parts) {
	const [, , action, ownerId, uwidText] = parts;
	const uwid = parseInt(uwidText, 10);
	if (interaction.user.id !== ownerId) return ephemeral(interaction, "This isn't your reroll!");
	const name = userName(interaction.guild, interaction.user);
	const doc = await weaponDb.getWeaponDoc(uwid, ownerId);
	const current = weaponDb.parseWeapon(doc);
	const next = weaponDb.pendingWeapon(doc);
	if (!current || !next) {
		return interaction.update({ content: 'This reroll is no longer active.', components: [] });
	}

	if (action === 'confirm') {
		const saved = await weaponDb.confirmReroll(ownerId, uwid);
		const msg = weaponView.rerollMessage(ownerId, name, current, next, { disabled: true, color: 0x00ff00 });
		if (!saved) msg.content = 'Failed to change weapon stats!';
		return interaction.update(msg);
	}
	if (action === 'cancel') {
		await weaponDb.cancelReroll(ownerId, uwid);
		return interaction.update(weaponView.rerollMessage(ownerId, name, current, next, { disabled: true, color: 0xff0000 }));
	}
	if (action === 'again') {
		const type = doc.pending.type;
		const result = await weaponDb.startReroll(ownerId, uwid, type);
		if (result.error === 'shards') {
			return interaction.update(weaponView.rerollMessage(ownerId, name, current, next, { note: `You don't have enough ${emojis.shard()} Weapon Shards!`, color: 0xff0000 }));
		}
		if (result.error) return interaction.update({ content: 'This reroll is no longer active.', components: [] });
		return interaction.update(weaponView.rerollMessage(ownerId, name, result.weapon, result.next));
	}
}

async function handleButton(interaction) {
	const parts = interaction.customId.split(':');
	try {
		if (parts[1] === 'accept' || parts[1] === 'decline') return await friend.handleButton(interaction);
		if (parts[1] === 'wp') return await handleWeaponPage(interaction, parts);
		if (parts[1] === 'wpf') return await handleWeaponFilter(interaction, parts);
		if (parts[1] === 'wps') return await handleWeaponSort(interaction, parts);
		if (parts[1] === 'wph') return await handleWeaponHelp(interaction, parts);
		if (parts[1] === 'rr') return await handleReroll(interaction, parts);
	} catch (error) {
		console.error('[BATTLE] button failed:', error);
		if (!interaction.replied && !interaction.deferred) {
			await interaction.reply({ content: 'Something went wrong... Try again!', flags: MessageFlags.Ephemeral }).catch(() => {});
		}
	}
}

module.exports = { BUTTON_PREFIX, handleButton };
