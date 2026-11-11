/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 */
const cfg = require('../config');
const teamUtil = require('./teamUtil.js');
const { EMBED_COLOR } = require('./battleDisplay.js');

const HELP = [
	`\`${cfg.PREFIX}team add {animal} {pos}\` Add an animal to your team`,
	`\`${cfg.PREFIX}team remove {pos}\` Removes an animal from your team`,
	`\`${cfg.PREFIX}team rename {name}\` Renames your team`,
	`\`${cfg.PREFIX}rename {animal} {name}\` Rename an animal`,
	`\`${cfg.PREFIX}setteam {teamNum}\` to set multiple teams`
].join('\n');

/* Embed untuk satu team (slots = [name|null x3]) */
async function teamEmbed(userId, ownerName, avatar, teamDoc, index, total, active) {
	const animals = await teamUtil.buildAnimals(userId, teamDoc.slots, index);
	const digits = teamUtil.statDigits(animals);
	const fields = [];
	for (let pos = 1; pos <= teamUtil.SLOT_COUNT; pos++) {
		const animal = animals.find((a) => a.pos === pos);
		if (!animal) {
			fields.push({ name: `[${pos}] none`, value: `*\`${cfg.PREFIX}team add {animal} ${pos}\`*`, inline: true });
		} else {
			fields.push({
				name: `[${pos}] ${animal.animal.uni} **${animal.nickname}**`.slice(0, 256),
				value: teamUtil.statBlock(animal, digits),
				inline: true
			});
		}
	}
	return {
		author: { name: `${ownerName}'s ${teamDoc.name || 'team'}`, icon_url: avatar },
		description: HELP,
		color: EMBED_COLOR,
		footer: { text: `Current Streak: ${teamDoc.streak || 0} | Highest Streak: ${teamDoc.highestStreak || 0} | Page ${index + 1}/${total}${active ? ' ⭐' : ''}` },
		fields
	};
}

/* Semua team (maks 2) sebagai array embed, atau null kalau belum punya team. */
async function teamEmbeds(userId, ownerName, avatar) {
	const doc = await teamUtil.getTeamDoc(userId);
	if (!doc?.teams?.length) return null;
	const total = teamUtil.MAX_TEAMS;
	const embeds = [];
	for (let i = 0; i < total; i++) {
		const team = doc.teams[i] || { name: null, slots: [null, null, null], streak: 0, highestStreak: 0 };
		embeds.push(await teamEmbed(userId, ownerName, avatar, team, i, total, doc.active === i));
	}
	// hanya deskripsi bantuan di embed pertama supaya tidak terlalu panjang
	for (let i = 1; i < embeds.length; i++) delete embeds[i].description;
	return embeds;
}

module.exports = { teamEmbeds, teamEmbed, HELP };
