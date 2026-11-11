/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 *
 * Satu pintu untuk semua tombol battle/weapon (customId diawali "fbattle:"):
 *   fbattle:accept|decline:<senderId>:<receiverId>   battle teman
 *   fbattle:wp:<ownerId>:<sort>:<wid>:<page>          paging daftar senjata
 *   fbattle:rr:<confirm|cancel|again>:<ownerId>:<uwid> reroll senjata
 */
const { MessageFlags } = require('discord.js');
const friend = require('./battleFriend.js');
const weaponDb = require('./weaponDb.js');
const weaponView = require('./weaponView.js');
const { userName } = require('./commandUtil.js');

const BUTTON_PREFIX = friend.BUTTON_PREFIX;
const ephemeral = (interaction, content) => interaction.reply({ content, flags: MessageFlags.Ephemeral });

async function handleWeaponPage(interaction, parts) {
	const [, , ownerId, sort, wid, page] = parts;
	if (interaction.user.id !== ownerId) return ephemeral(interaction, "This isn't your weapon list!");
	const message = await weaponView.listMessage(ownerId, userName(interaction.guild, interaction.user), {
		page: parseInt(page, 10) || 0, sort, wid: parseInt(wid, 10) || undefined
	});
	if (!message) return interaction.update({ components: [] });
	return interaction.update(message);
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
			return interaction.update(weaponView.rerollMessage(ownerId, name, current, next, { note: `You don't have enough ${weaponView.SHARD_EMOJI} Weapon Shards!`, color: 0xff0000 }));
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
		if (parts[1] === 'rr') return await handleReroll(interaction, parts);
	} catch (error) {
		console.error('[BATTLE] button failed:', error);
		if (!interaction.replied && !interaction.deferred) {
			await interaction.reply({ content: 'Something went wrong... Try again!', flags: MessageFlags.Ephemeral }).catch(() => {});
		}
	}
}

module.exports = { BUTTON_PREFIX, handleButton };
