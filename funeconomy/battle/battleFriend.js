/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 *
 * Battle teman: sbattle @user -> tombol Accept/Decline (atau sab / sdb).
 */
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { track } = require('../inactivity.js');
const cfg = require('../config');
const teamUtil = require('./teamUtil.js');
const challengeDb = require('./challengeDb.js');
const settingsDb = require('./settingsDb.js');
const BattleEvent = require('./battleEvent.js');
const { displayBattle, EMBED_COLOR } = require('./battleDisplay.js');
const { userName } = require('./commandUtil.js');

const BUTTON_PREFIX = 'fbattle';

const animalLine = (animal) => {
	let text = `L.${animal.stats.lvl} ${animal.animal.uni} ${animal.nickname}`;
	if (animal.weapon) text += ` | ${animal.weapon.rank.emoji}${animal.weapon.emoji}${animal.weapon.passives.map((p) => p.emoji).join('')} ${animal.weapon.avgQuality}%`;
	return text;
};

function flagText(flags) {
	let text = '';
	for (const flag of String(flags || '').split(',').filter(Boolean)) {
		if (flag === 'log' || flag === 'link') text += '`LOGS` ';
		else if (['compact', 'image', 'text'].includes(flag)) text += `\`${flag.toUpperCase()}\` `;
		else if (/^l[0-9]+$/.test(flag)) text += `\`LVL${flag.substring(1)}\` `;
	}
	return text ? `\nFlags: ${text}` : '';
}

function requestEmbed({ senderName, receiverName, sender, receiver, record, flags, selfBattle }) {
	const wins = (id) => (selfBattle ? '' : ` | ${record[id] || 0} wins`);
	return {
		author: { name: `${receiverName}, ${senderName} challenges you to a duel!` },
		description: `${flagText(flags)}\n\`${cfg.PREFIX}ab\` to accept the battle!\n\`${cfg.PREFIX}db\` to decline the battle!`,
		color: EMBED_COLOR,
		footer: { text: 'This challenge will expire in 10 minutes' },
		timestamp: new Date().toISOString(),
		fields: [
			{ name: `${sender.name || `${senderName}'s Team`}${wins(sender.userId)}`.slice(0, 256), value: sender.team.map(animalLine).join('\n').slice(0, 1024), inline: true },
			{ name: `${receiver.name || `${receiverName}'s Team`}${wins(receiver.userId)}`.slice(0, 256), value: receiver.team.map(animalLine).join('\n').slice(0, 1024), inline: true }
		]
	};
}

const buttons = (senderId, receiverId, disabled = false) => [new ActionRowBuilder().addComponents(
	new ButtonBuilder().setCustomId(`${BUTTON_PREFIX}:accept:${senderId}:${receiverId}`).setLabel('Accept').setStyle(ButtonStyle.Success).setDisabled(disabled),
	new ButtonBuilder().setCustomId(`${BUTTON_PREFIX}:decline:${senderId}:${receiverId}`).setLabel('Decline').setStyle(ButtonStyle.Danger).setDisabled(disabled)
)];

/* sbattle @user. Return pesan error (string) atau null kalau tantangan terkirim. */
async function challenge(message, opponent, flagTokens) {
	const guild = message.guild;
	const senderId = message.author.id;
	const selfBattle = opponent.id === senderId;
	if (opponent.bot) return "you can't battle a bot!";

	const player = await teamUtil.getBattleTeam(senderId);
	if (!player) return `You don't have a team! Create one with \`${cfg.PREFIX}team add {animal}\``;
	const enemy = await teamUtil.getBattleTeam(opponent.id, { notActive: selfBattle });
	if (!enemy) return selfBattle
		? "You need a second team with animals to battle yourself! Use `" + cfg.PREFIX + "setteam 2`"
		: "The opponent doesn't have a team!";

	const flags = challengeDb.parseFlags(flagTokens);
	const created = await challengeDb.create({ sender: senderId, opponent: opponent.id, flags, channelId: message.channel.id });
	if (created.error) return 'There is already a pending battle!';

	const record = await challengeDb.getRecord(senderId, opponent.id);
	const wins = { [record.user1]: record.win1, [record.user2]: record.win2 };
	const embed = requestEmbed({
		senderName: userName(guild, message.author), receiverName: userName(guild, opponent),
		sender: player, receiver: enemy, record: wins, flags, selfBattle
	});
	const sent = await message.channel.send({
		content: `<@${opponent.id}>`, embeds: [embed], components: buttons(senderId, opponent.id),
		allowedMentions: { users: [opponent.id] }
	});
	track(sent);
	await challengeDb.setMessage(created.doc.user1, created.doc.user2, sent.id).catch(() => {});
	return null;
}

/*
 * Jalankan battle teman setelah tantangan diterima (challenge sudah ditutup).
 * acceptor = yang menerima (lawan), sender = penantang. send(embed) mengirim embed ke channel.
 */
async function runFriendBattle({ guild, channel, acceptor, sender, flags }) {
	const f = challengeDb.readFlags(flags);
	const selfBattle = acceptor.id === sender.id;
	const player = await teamUtil.getBattleTeam(sender.id, { level: f.level });
	const enemy = await teamUtil.getBattleTeam(acceptor.id, { level: f.level, notActive: selfBattle });
	if (!player || !enemy) {
		return channel.send({ content: `${cfg.EMOJI.ERROR} | There was an error finding the teams for this battle!`, allowedMentions: { parse: [] } });
	}
	const senderName = userName(guild, sender);
	const acceptorName = userName(guild, acceptor);
	const event = new BattleEvent({ friendly: true, playerName: senderName, enemyName: acceptorName });
	event.init(player, enemy);
	event.simulateBattle();

	let winner = null;
	if (event.endResult.outcome === 'player') winner = sender.id;
	else if (event.endResult.outcome === 'enemy') winner = acceptor.id;
	if (!selfBattle) await challengeDb.recordResult(sender.id, acceptor.id, winner);

	const own = await settingsDb.getBattleSetting(sender.id);
	const setting = {
		display: f.display || own.display,
		speed: f.log ? 'instant' : 'short',
		showLogs: !!f.log
	};
	return displayBattle(
		event, setting,
		(embed, files) => channel.send({ embeds: [embed], files, allowedMentions: { parse: [] } }),
		{ title: `${senderName} vs ${acceptorName}`, iconURL: sender.displayAvatarURL?.({ extension: 'png', size: 64 }) }
	);
}

/* sab / tombol Accept. Return pesan error (string) atau null bila battle dijalankan. */
async function accept({ guild, channel, acceptor, client }) {
	const active = await challengeDb.findActive(acceptor.id);
	if (!active || (active.sender === acceptor.id && active.user1 !== active.user2)) return 'You do not have any pending battles!';
	if (active.channelId !== channel.id) return 'You can only accept battle requests from the same channel!';
	const closed = await challengeDb.close(acceptor.id);
	if (!closed) return 'You do not have any pending battles!';
	const sender = await client.users.fetch(closed.sender).catch(() => null);
	if (!sender) return 'I could not find your opponent!';
	await runFriendBattle({ guild, channel, acceptor, sender, flags: closed.flags });
	return null;
}

/* sdb / tombol Decline. Return nama lawan atau null kalau tidak ada tantangan. */
async function decline({ user, client }) {
	const closed = await challengeDb.close(user.id);
	if (!closed) return null;
	const otherId = closed.user1 === user.id ? closed.user2 : closed.user1;
	const other = await client.users.fetch(otherId).catch(() => null);
	return { other, closed };
}

/* Klik tombol Accept/Decline */
async function handleButton(interaction) {
	const [, action, senderId, receiverId] = interaction.customId.split(':');
	if (!['accept', 'decline'].includes(action) || !senderId || !receiverId) return;
	const user = interaction.user;
	if (![senderId, receiverId].includes(user.id)) {
		return interaction.reply({ content: "This isn't your battle request!", flags: MessageFlags.Ephemeral });
	}
	const base = interaction.message.embeds?.[0]?.data || interaction.message.embeds?.[0] || {};

	if (action === 'accept') {
		if (user.id !== receiverId) {
			return interaction.reply({ content: `${cfg.EMOJI.ERROR} | The opponent must accept the battle.`, flags: MessageFlags.Ephemeral });
		}
		const error = await accept({ guild: interaction.guild, channel: interaction.channel, acceptor: user, client: interaction.client });
		if (error) return interaction.reply({ content: `${cfg.EMOJI.ERROR} | ${error}`, flags: MessageFlags.Ephemeral });
		return interaction.update({ embeds: [{ ...base, color: 0x00ff00, footer: { text: 'The battle was accepted!' } }], components: buttons(senderId, receiverId, true) }).catch(() => {});
	}

	const result = await decline({ user, client: interaction.client });
	if (!result) return interaction.reply({ content: `${cfg.EMOJI.ERROR} | You do not have any pending battles!`, flags: MessageFlags.Ephemeral });
	return interaction.update({ embeds: [{ ...base, color: 0xff0000, footer: { text: 'The battle was declined.' } }], components: buttons(senderId, receiverId, true) }).catch(() => {});
}

module.exports = { BUTTON_PREFIX, challenge, accept, decline, runFriendBattle, handleButton };
