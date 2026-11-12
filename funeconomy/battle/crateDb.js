/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 */
const cfg = require('../config');
const Crate = require('../../models/funeconomy/crate');
const weaponDb = require('./weaponDb.js');

const CRATE_CHANCE = 0.05;
const MAX_PER_DAY = 3;
const MAX_OPEN = 20;
const DAY_MS = 24 * 60 * 60 * 1000;
const OFFSET_MS = cfg.TIMEZONE_OFFSET_HOURS * 60 * 60 * 1000;

const dayNumber = (now = Date.now()) => Math.floor((now + OFFSET_MS) / DAY_MS);
const msUntilReset = (now = Date.now()) => (dayNumber(now) + 1) * DAY_MS - OFFSET_MS - now;

async function ensure(userId) {
	await Crate.updateOne(
		{ userId },
		{ $setOnInsert: { boxcount: 0, claimcount: 0, claimDay: -1, shards: 0 } },
		{ upsert: true }
	).catch((error) => { if (error?.code !== 11000) throw error; });
}

async function getCrate(userId) {
	return (await Crate.findOne({ userId }).lean()) || { boxcount: 0, claimcount: 0, claimDay: -1, shards: 0 };
}

/*
 * Crate dari battle (OwO crateFromBattle): battle pertama di hari baru selalu dapat crate,
 * setelah itu 5% per battle sampai 3 crate per hari. Return { found, count, resetsIn } atau { found:false }.
 */
async function crateFromBattle(userId, { now = Date.now(), random = Math.random } = {}) {
	const today = dayNumber(now);
	await ensure(userId);

	// Hari baru: crate pertama dijamin (atomik: hanya satu proses yang bisa mereset hari ini)
	const first = await Crate.findOneAndUpdate(
		{ userId, claimDay: { $lt: today } },
		{ $inc: { boxcount: 1 }, $set: { claimcount: 1, claimDay: today } },
		{ new: true }
	).lean();
	if (first) return { found: true, count: 1, resetsIn: msUntilReset(now) };

	if (random() > CRATE_CHANCE) return { found: false };
	const more = await Crate.findOneAndUpdate(
		{ userId, claimDay: today, claimcount: { $lt: MAX_PER_DAY } },
		{ $inc: { boxcount: 1, claimcount: 1 } },
		{ new: true }
	).lean();
	if (!more) return { found: false };
	return { found: true, count: more.claimcount, resetsIn: msUntilReset(now) };
}

/* Buka crate secara atomik lalu simpan senjatanya. Return { weapons } atau { error:'none' } */
async function openCrates(userId, count) {
	count = Math.min(Math.max(1, count), MAX_OPEN);
	const taken = await Crate.findOneAndUpdate(
		{ userId, boxcount: { $gte: count } }, { $inc: { boxcount: -count } }, { new: true }
	).lean();
	if (!taken) return { error: 'none' };
	const weapons = [];
	for (let i = 0; i < count; i++) {
		weapons.push(await weaponDb.saveWeapon(userId, weaponDb.randomWeapon()));
	}
	return { weapons };
}

async function addCrates(userId, amount) {
	await ensure(userId);
	return Crate.findOneAndUpdate({ userId }, { $inc: { boxcount: amount } }, { new: true }).lean();
}

async function getShards(userId) {
	return (await getCrate(userId)).shards || 0;
}

async function addShards(userId, amount) {
	await ensure(userId);
	return Crate.findOneAndUpdate({ userId }, { $inc: { shards: amount } }, { new: true }).lean();
}

/* Bayar dengan weapon shard secara atomik (shop). Return dokumen baru atau null kalau shard kurang. */
async function useShards(userId, amount) {
	if (!(amount > 0)) return null;
	return Crate.findOneAndUpdate(
		{ userId, shards: { $gte: amount } }, { $inc: { shards: -amount } }, { new: true }
	).lean();
}

module.exports = {
	useShards,
	CRATE_CHANCE, MAX_PER_DAY, MAX_OPEN, dayNumber, msUntilReset,
	getCrate, crateFromBattle, openCrates, addCrates, getShards, addShards
};
