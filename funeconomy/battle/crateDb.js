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
	const fresh = Array.from({ length: count }, () => weaponDb.randomWeapon());
	try {
		return { weapons: await weaponDb.saveWeapons(userId, fresh) };
	} catch (error) {
		// Gagal menyimpan: kembalikan crate supaya tidak hilang.
		await Crate.updateOne({ userId }, { $inc: { boxcount: count } }).catch(() => {});
		throw error;
	}
}

/* Hasil buka crate diingat sementara supaya tombol 🔍 bisa membuka detail tiap senjata selama 10 menit (hilang juga saat bot restart). */
const OPENED = new Map();
const OPENED_TTL = 10 * 60 * 1000; // sama dengan waktu tombol 🔍 aktif di pesan crate
const OPENED_MAX = 500;
const OPENED_TTL_MS = OPENED_TTL;

function rememberOpen(messageId, userId, uwids) {
	const now = Date.now();
	for (const [key, value] of OPENED) if (now - value.at > OPENED_TTL) OPENED.delete(key);
	while (OPENED.size >= OPENED_MAX) OPENED.delete(OPENED.keys().next().value);
	OPENED.set(String(messageId), { userId: String(userId), uwids: uwids.slice(), at: now });
}

function recallOpen(messageId) {
	const entry = OPENED.get(String(messageId));
	if (!entry) return null;
	if (Date.now() - entry.at > OPENED_TTL) { OPENED.delete(String(messageId)); return null; }
	return entry;
}

async function addCrates(userId, amount) {
	await ensure(userId);
	return Crate.findOneAndUpdate({ userId }, { $inc: { boxcount: amount } }, { new: true }).lean();
}

/* Crate boss: tiap crate berisi 3 senjata acak, yang disimpan hanya yang kualitasnya paling tinggi. */
async function addBossCrates(userId, amount) {
	await ensure(userId);
	return Crate.findOneAndUpdate({ userId }, { $inc: { bossbox: amount } }, { new: true }).lean();
}

async function openBossCrates(userId, count) {
	count = Math.min(Math.max(1, count), MAX_OPEN);
	const taken = await Crate.findOneAndUpdate(
		{ userId, bossbox: { $gte: count } }, { $inc: { bossbox: -count } }, { new: true }
	).lean();
	if (!taken) return { error: 'none' };
	const fresh = Array.from({ length: count }, () => {
		const picks = Array.from({ length: 3 }, () => weaponDb.randomWeapon());
		return picks.reduce((best, w) => (w.avgQuality > best.avgQuality ? w : best));
	});
	try {
		return { weapons: await weaponDb.saveWeapons(userId, fresh) };
	} catch (error) {
		await Crate.updateOne({ userId }, { $inc: { bossbox: count } }).catch(() => {});
		throw error;
	}
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
	getCrate, crateFromBattle, openCrates, addCrates, addBossCrates, openBossCrates, rememberOpen, recallOpen, OPENED_TTL_MS, getShards, addShards
};
