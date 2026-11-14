/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 *
 * Penghubung hunt -> team dan semua logika team.
 * Kontrak untuk hunt:
 *   getActiveTeamPets(userId) -> [{ name, uni }]  (hewan di team aktif, urut posisi)
 *   giveXpToUserTeams(userId, xp) -> Promise<void>  (XP ke hewan di team aktif; user tanpa team = tidak berbuat apa-apa)
 */
const Team = require('../../models/funeconomy/team');
const Animal = require('../../models/funeconomy/animal');
const { ANIMALS, RANKS } = require('../zoo/data');
const animalUtil = require('./animalUtil.js');
const weaponDb = require('./weaponDb.js');
const WeaponInterface = require('./WeaponInterface.js');

const MAX_TEAMS = 2;
const SLOT_COUNT = 3;
const MAX_TEAM_NAME = 35;

const emptyTeam = () => ({ name: null, slots: [null, null, null], streak: 0, highestStreak: 0 });
const slotPath = (index, pos) => `teams.${index}.slots.${pos - 1}`;
const filled = (team) => (team?.slots || []).filter(Boolean);

async function getTeamDoc(userId) {
	return Team.findOne({ userId }).lean();
}

/* Pastikan dokumen ada dan team ke-`index` sudah dibuat. Return dokumen terbaru. */
async function ensureTeams(userId, count = 1) {
	await Team.updateOne(
		{ userId },
		{ $setOnInsert: { active: 0, teams: [emptyTeam()] } },
		{ upsert: true }
	).catch((error) => { if (error?.code !== 11000) throw error; });
	let doc = await getTeamDoc(userId);
	while (doc.teams.length < Math.min(count, MAX_TEAMS)) {
		await Team.updateOne(
			{ userId, [`teams.${doc.teams.length}`]: { $exists: false } },
			{ $push: { teams: emptyTeam() } }
		);
		doc = await getTeamDoc(userId);
	}
	return doc;
}

/* Team aktif (atau yang paling awal berisi) sebagai { index, team } atau null */
async function getActiveTeam(userId) {
	const doc = await getTeamDoc(userId);
	if (!doc || !doc.teams?.length) return null;
	const index = doc.teams[doc.active] ? doc.active : 0;
	return { index, team: doc.teams[index], doc };
}

/* Kontrak hunt: hewan di team aktif */
async function getActiveTeamPets(userId) {
	try {
		const active = await getActiveTeam(userId);
		if (!active) return [];
		return filled(active.team).filter((key) => ANIMALS[key]).map((key) => ({ name: key, uni: ANIMALS[key].uni }));
	} catch (error) {
		console.error('[BATTLE] getActiveTeamPets failed:', error.message);
		return [];
	}
}

async function incXp(userId, names, xp, overrides = {}) {
	await Promise.all(names.map((name) => {
		const amount = Math.ceil(overrides[name] ?? xp);
		if (!(amount > 0)) return null;
		return Animal.updateOne({ userId, name }, { $inc: { xp: amount } });
	}));
}

/*
 * Kontrak hunt: beri XP ke hewan di team aktif.
 * opts.xpOverrides = { animalKey: xp } (XP battle per hewan), opts.secondary = team lain dapat setengah XP (seperti OwO).
 */
async function giveXpToUserTeams(userId, xp, opts = {}) {
	try {
		if (!userId || !(Number(xp) > 0)) return;
		const active = await getActiveTeam(userId);
		if (!active) return;
		const names = filled(active.team);
		if (!names.length) return;
		await incXp(userId, names, xp, opts.xpOverrides);

		if (opts.secondary && active.doc.teams.length > 1) {
			const other = active.doc.teams[(active.index + 1) % active.doc.teams.length];
			const otherNames = filled(other).filter((n) => !names.includes(n));
			if (otherNames.length) await incXp(userId, otherNames, xp / 2);
		}
	} catch (error) {
		console.error('[BATTLE] giveXpToUserTeams failed:', error.message);
	}
}

/* ---- Edit team ---- */

async function ownsAnimal(userId, key) {
	const doc = await Animal.findOne({ userId, name: key }).lean();
	return !!doc;
}

/* Tambah hewan ke team aktif. Return { ok, slots, pos } atau { error } */
async function addMember(userId, key, pos) {
	const doc = await ensureTeams(userId);
	const index = doc.teams[doc.active] ? doc.active : 0;
	const team = doc.teams[index];
	if (filled(team).includes(key)) return { error: 'duplicate' };
	if (!pos) {
		for (let i = 1; i <= SLOT_COUNT; i++) if (!team.slots[i - 1]) { pos = i; break; }
	}
	if (!pos) return { error: 'full' };
	if (!(await ownsAnimal(userId, key))) return { error: 'notowned' };

	const prev = team.slots[pos - 1] ?? null;
	const updated = await Team.findOneAndUpdate(
		{ userId, [`teams.${index}.slots`]: { $ne: key }, [slotPath(index, pos)]: prev },
		{ $set: { [slotPath(index, pos)]: key } },
		{ new: true }
	).lean();
	if (!updated) return { error: 'conflict' };
	return { ok: true, pos, slots: updated.teams[index].slots, index };
}

/* Hapus hewan (posisi 1-3 atau key) dari team aktif; minimal satu hewan harus tersisa. */
async function removeMember(userId, target) {
	const active = await getActiveTeam(userId);
	if (!active || !filled(active.team).length) return { error: 'empty' };
	const { index, team } = active;
	const pos = typeof target === 'number' ? target : team.slots.indexOf(target) + 1;
	if (!pos || !team.slots[pos - 1]) return { error: 'notinteam' };
	if (filled(team).length <= 1) return { error: 'last' };
	const updated = await Team.findOneAndUpdate(
		{ userId, [slotPath(index, pos)]: team.slots[pos - 1] },
		{ $set: { [slotPath(index, pos)]: null } },
		{ new: true }
	).lean();
	if (!updated) return { error: 'conflict' };
	return { ok: true, slots: updated.teams[index].slots, index };
}

async function renameTeam(userId, name) {
	name = String(name).replace(/[\u0000-\u001f`@]/g, '').trim();
	if (!name.length) return { error: 'invalid' };
	if (name.length > MAX_TEAM_NAME) return { error: 'long' };
	const active = await getActiveTeam(userId);
	if (!active) return { error: 'noteam' };
	await Team.updateOne({ userId }, { $set: { [`teams.${active.index}.name`]: name } });
	return { ok: true, name };
}

/* Pilih team aktif (1-based). Membuat team kosong kalau belum ada. */
async function setActive(userId, number) {
	if (!Number.isInteger(number) || number < 1 || number > MAX_TEAMS) return { error: 'invalid' };
	const doc = await ensureTeams(userId, number);
	await Team.updateOne({ userId }, { $set: { active: number - 1 } });
	return { ok: true, doc: { ...doc, active: number - 1 } };
}

async function updateTeamStreak(userId, index, { addStreak, resetStreak }) {
	if (addStreak) {
		const updated = await Team.findOneAndUpdate(
			{ userId }, { $inc: { [`teams.${index}.streak`]: 1 } }, { new: true }
		).lean();
		if (updated) {
			await Team.updateOne({ userId }, { $max: { [`teams.${index}.highestStreak`]: updated.teams[index].streak } });
		}
	} else if (resetStreak) {
		await Team.updateOne({ userId }, { $set: { [`teams.${index}.streak`]: 0 } });
	}
}

/* ---- Battle team ---- */

/* Hewan battle dari dokumen team + hewan + senjata. */
async function buildAnimals(userId, slots, teamIndex, level) {
	const names = slots.filter(Boolean);
	if (!names.length) return [];
	const [docs, weaponDocs] = await Promise.all([
		Animal.find({ userId, name: { $in: names } }).lean(),
		weaponDb.weaponsForAnimals(userId, names)
	]);
	const byName = {};
	for (const d of docs) byName[d.name] = d;

	const team = [];
	slots.forEach((key, i) => {
		const data = ANIMALS[key];
		if (!key || !data || !byName[key]) return;
		const animal = {
			pid: `${userId}:${teamIndex}:${key}`,
			key,
			animal: data,
			nickname: byName[key].nickname || data.name,
			pos: i + 1,
			xp: byName[key].xp || 0,
			buffs: [],
			debuffs: []
		};
		const weapon = weaponDocs[key] ? weaponDb.parseWeapon(weaponDocs[key]) : null;
		if (weapon) animal.weapon = weapon;
		animalUtil.stats(animal, level);
		team.push(animal);
	});
	return team;
}

/* Team battle milik user. opts: level (paksa level), notActive (pakai team non-aktif, untuk battle lawan diri sendiri) */
async function getBattleTeam(userId, { level, notActive } = {}) {
	const doc = await getTeamDoc(userId);
	if (!doc?.teams?.length) return null;
	let index = doc.teams[doc.active] ? doc.active : 0;
	if (notActive) {
		index = doc.teams.findIndex((t, i) => i !== index && filled(t).length);
		if (index < 0) return null;
	}
	const team = doc.teams[index];
	const animals = await buildAnimals(userId, team.slots, index, level);
	if (!animals.length) return null;
	return {
		userId, index,
		name: team.name,
		streak: team.streak || 0,
		highestStreak: team.highestStreak || 0,
		team: animals
	};
}

const hasWeaponFraction = (team) => team.team.filter((a) => a.weapon).length / Math.max(1, team.team.length);

/* Lawan random yang kekuatannya mengikuti team pemain (level rata-rata, jumlah hewan, senjata) */
function generateEnemyTeam(playerTeam, { random = Math.random } = {}) {
	const avgLvl = playerTeam.team.reduce((a, b) => a + b.stats.lvl, 0) / playerTeam.team.length;
	const weaponChance = hasWeaponFraction(playerTeam);
	const pool = Object.values(ANIMALS).map((a) => ({ a, w: Math.pow(Math.max(RANKS[a.rank].rarity, 0.05), 0.25) }));
	const total = pool.reduce((s, p) => s + p.w, 0);

	const used = new Set();
	const team = [];
	const count = playerTeam.team.length;
	for (let i = 0; i < count; i++) {
		let key;
		for (let tries = 0; tries < 20; tries++) {
			let roll = random() * total;
			let pick = pool[pool.length - 1];
			for (const p of pool) { roll -= p.w; if (roll <= 0) { pick = p; break; } }
			if (!used.has(pick.a.key)) { key = pick.a.key; break; }
		}
		if (!key) key = pool.find((p) => !used.has(p.a.key)).a.key;
		used.add(key);
		const lvl = Math.max(1, Math.round(avgLvl * (0.85 + random() * 0.3)));
		const animal = {
			pid: `npc:${i}:${key}`, key, animal: ANIMALS[key], nickname: ANIMALS[key].name,
			pos: i + 1, xp: animalUtil.xpForLevel(lvl), buffs: [], debuffs: []
		};
		if (random() < weaponChance) animal.weapon = weaponDb.randomWeapon();
		animalUtil.stats(animal);
		team.push(animal);
	}
	return { userId: null, index: 0, name: 'Enemy Team', streak: 0, highestStreak: 0, team };
}

/* Checks if the team is dead */
function isDead(team) {
	let totalhp = 0;
	for (const a of team) totalhp += Math.max(0, a.stats.hp[0]);
	return totalhp <= 0;
}

const getPidFromTeam = (team) => team.team.map((a) => a.pid);

/* ---- Tampilan ---- */

const statDigits = (animals) => {
	let digits = 1;
	for (const a of animals) {
		for (const v of [a.stats.hp[1] + a.stats.hp[3], a.stats.wp[1] + a.stats.wp[3], a.stats.att[0] + a.stats.att[1],
			a.stats.mag[0] + a.stats.mag[1], a.stats.pr[0] + a.stats.pr[1], a.stats.mr[0] + a.stats.mr[1]]) {
			digits = Math.max(digits, Math.trunc(Math.log10(Math.max(1, v)) + 1));
		}
	}
	return digits;
};

const weaponLine = (weapon) => {
	if (!weapon) return '';
	return `\`${weapon.uwid}\` ${weapon.rank.emoji} ${weapon.emoji} ${weapon.passives.map((p) => p.emoji).join(' ')} ${weapon.avgQuality}%`.replace(/\s+/g, ' ');
};

/* Blok teks statistik satu hewan */
function statBlock(animal, digits) {
	const pad = (n) => String(Math.ceil(n)).padStart(digits, '0');
	const s = animal.stats;
	const lines = [
		`Lvl ${s.lvl} \`[${Math.round(s.xp[0]).toLocaleString('en-US')}/${s.xp[1].toLocaleString('en-US')}]\``,
		`${WeaponInterface.hpEmoji} \`${pad(s.hp[1] + s.hp[3])}\` ${WeaponInterface.wpEmoji} \`${pad(s.wp[1] + s.wp[3])}\``,
		`${WeaponInterface.strEmoji} \`${pad(s.att[0] + s.att[1])}\` ${WeaponInterface.magEmoji} \`${pad(s.mag[0] + s.mag[1])}\``,
		`${WeaponInterface.prEmoji} \`${WeaponInterface.resToPrettyPercent(s.pr)}\` ${WeaponInterface.mrEmoji} \`${WeaponInterface.resToPrettyPercent(s.mr)}\``
	];
	if (animal.weapon) lines.push(weaponLine(animal.weapon));
	return lines.join('\n');
}

module.exports = {
	MAX_TEAMS, SLOT_COUNT,
	getActiveTeamPets, giveXpToUserTeams,
	getTeamDoc, ensureTeams, getActiveTeam, addMember, removeMember, renameTeam, setActive, updateTeamStreak,
	getBattleTeam, buildAnimals, generateEnemyTeam, isDead, getPidFromTeam,
	statDigits, statBlock, weaponLine, filled, ownsAnimal
};
			
