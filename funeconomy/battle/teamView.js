/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 */
const cfg = require('../config');
const teamUtil = require('./teamUtil.js');
const { EMBED_COLOR } = require('./battleDisplay.js');
const Animal = require('../../models/funeconomy/animal');
const animalUtil = require('./animalUtil.js');
const { ANIMALS } = require('../zoo/data');

const V2 = 32768; // MessageFlags.IsComponentsV2
const PER_PAGE = 24; // + satu opsi "kosong" = 25 (batas select menu)
const text = (content) => ({ type: 10, content });
const separator = () => ({ type: 14, divider: true, spacing: 1 });
const button = (customId, { label, emoji, style = 2, disabled = false } = {}) => ({
	type: 2, custom_id: customId, style, disabled, ...(label ? { label } : {}), ...(emoji ? { emoji: { name: emoji } } : {})
});

/* Emoji hewan (unicode atau <:nama:id>) -> objek emoji untuk select menu */
function optionEmoji(uni) {
	const m = /^<(a?):(\w+):(\d+)>$/.exec(String(uni || ''));
	if (m) return { id: m[3], name: m[2], animated: !!m[1] };
	return uni ? { name: uni } : undefined;
}

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

/*
 * Tampilan team seperti OwO: satu team per halaman + tombol ◀ 1/2 ▶ ⭐ (jadikan team aktif) ⚙️ (pengaturan).
 * customId: fbattle:tv:<owner>:<index>:<prev|next|star|gear>
 */
async function teamPage(userId, ownerName, avatar, index, { expired = false } = {}) {
	const doc = await teamUtil.getTeamDoc(userId);
	if (!doc?.teams?.length) return null;
	const total = teamUtil.MAX_TEAMS;
	index = ((index % total) + total) % total;
	const team = doc.teams[index] || { name: null, slots: [null, null, null], streak: 0, highestStreak: 0 };
	const active = (doc.teams[doc.active] ? doc.active : 0) === index;
	const embed = await teamEmbed(userId, ownerName, avatar, team, index, total, active);
	const id = (act) => `fbattle:tv:${userId}:${index}:${act}`;
	const components = [{
		type: 1,
		components: [
			button(id('prev'), { emoji: '◀️', disabled: expired }),
			button(`fbattle:tv:${userId}:${index}:page`, { label: `${index + 1}/${total}`, disabled: true }),
			button(id('next'), { emoji: '▶️', disabled: expired }),
			button(id('star'), { emoji: '⭐', style: active ? 1 : 2, disabled: expired }),
			button(id('gear'), { emoji: '⚙️', disabled: expired })
		]
	}];
	return { embeds: [embed], components };
}

/* Hewan yang boleh dipasang (punya, atau sudah ada di team), urut level tertinggi dulu */
async function pickableAnimals(userId, team) {
	const inTeam = teamUtil.filled(team);
	const docs = await Animal.find({ userId, $or: [{ count: { $gt: 0 } }, { name: { $in: inTeam } }] }).lean();
	return docs.filter((d) => ANIMALS[d.name]).map((d) => ({
		key: d.name, nickname: d.nickname || ANIMALS[d.name].name, uni: ANIMALS[d.name].uni, lvl: animalUtil.toLvl(d.xp || 0).lvl
	})).sort((a, b) => b.lvl - a.lvl || a.key.localeCompare(b.key));
}

/*
 * Pengaturan team (pesan ephemeral, Components V2): pilih team aktif + 3 slot hewan + halaman daftar hewan.
 * customId: fbattle:tsa:<owner>:<msgId>:<page> (team aktif), fbattle:tss:<owner>:<msgId>:<page>:<slot>, fbattle:tsp:<owner>:<msgId>:<page> (halaman)
 */
async function settingsMessage(userId, { page = 0, msgId = '0', notice } = {}) {
	const doc = await teamUtil.getTeamDoc(userId);
	if (!doc?.teams?.length) return null;
	const index = doc.teams[doc.active] ? doc.active : 0;
	const team = doc.teams[index];
	const animals = await pickableAnimals(userId, team);
	const pages = Math.max(1, Math.ceil(animals.length / PER_PAGE));
	page = Math.min(Math.max(0, page), pages - 1);
	const slice = animals.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

	const teamOptions = Array.from({ length: teamUtil.MAX_TEAMS }, (_, i) => ({
		label: (doc.teams[i]?.name || `Team ${i + 1}`).slice(0, 100), value: String(i), default: i === index
	}));
	const slotRows = [];
	for (let pos = 1; pos <= teamUtil.SLOT_COUNT; pos++) {
		const current = team.slots[pos - 1] || null;
		const options = [{ label: '— Empty slot —', value: 'none', default: !current }];
		for (const a of slice) {
			const option = { label: `[Lvl ${a.lvl}] ${a.nickname}`.slice(0, 100), value: a.key, default: a.key === current };
			const emoji = optionEmoji(a.uni);
			if (emoji) option.emoji = emoji;
			options.push(option);
		}
		slotRows.push(text(`**\`Animal in Team Slot ${pos}\`**`));
		slotRows.push({
			type: 1,
			components: [{ type: 3, custom_id: `fbattle:tss:${userId}:${msgId}:${page}:${pos}`, placeholder: 'Select Animal', options }]
		});
	}
	const components = [
		text('## Team Settings'),
		separator(),
		text('**`Current Active Battle Team`**'),
		{ type: 1, components: [{ type: 3, custom_id: `fbattle:tsa:${userId}:${msgId}:${page}`, placeholder: 'Select Active Battle Team', options: teamOptions }] },
		...slotRows,
		separator(),
		{
			type: 1,
			components: [
				button(`fbattle:tsp:${userId}:${msgId}:${page - 1}`, { emoji: '◀️', disabled: page <= 0 }),
				button(`fbattle:tsp:${userId}:${msgId}:${page}:now`, { label: `${page + 1}/${pages}`, disabled: true }),
				button(`fbattle:tsp:${userId}:${msgId}:${page + 1}`, { emoji: '▶️', disabled: page >= pages - 1 })
			]
		}
	];
	if (notice) components.push(text(notice));
	return { components: [{ type: 17, accent_color: EMBED_COLOR, components }], flags: V2 };
}

module.exports = { teamEmbeds, teamEmbed, teamPage, settingsMessage, HELP };
																		   
