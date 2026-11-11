/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 *
 * Tantangan battle teman (sbattle @user), 10 menit kedaluwarsa, plus rekor menang/kalah.
 */
const Challenge = require('../../models/funeconomy/battleChallenge');

const EXPIRE_MS = 10 * 60 * 1000;
const pair = (a, b) => (String(a) < String(b) ? [String(a), String(b)] : [String(b), String(a)]);
const fresh = (now = Date.now()) => new Date(now - EXPIRE_MS);

/* Tantangan aktif yang melibatkan user (siapa saja) */
async function findActive(userId, now = Date.now()) {
	return Challenge.findOne({
		$or: [{ user1: userId }, { user2: userId }],
		time: { $gt: fresh(now) }
	}).lean();
}

/* Buat tantangan baru. Return { error:'pending' } kalau salah satu sudah punya tantangan aktif. */
async function create({ sender, opponent, flags, channelId }, now = Date.now()) {
	const [user1, user2] = pair(sender, opponent);
	const existing = await Challenge.findOne({
		$or: [{ user1 }, { user2: user1 }, { user1: user2 }, { user2 }],
		time: { $gt: fresh(now) }
	}).lean();
	if (existing) return { error: 'pending' };
	await Challenge.updateOne({ user1, user2 }, { $setOnInsert: { win1: 0, win2: 0, tie: 0 } }, { upsert: true })
		.catch((error) => { if (error?.code !== 11000) throw error; });
	const doc = await Challenge.findOneAndUpdate(
		{ user1, user2, $or: [{ time: null }, { time: { $lte: fresh(now) } }] },
		{ $set: { sender: String(sender), flags: flags || '', channelId, messageId: null, time: new Date(now) } },
		{ new: true }
	).lean();
	if (!doc) return { error: 'pending' };
	return { doc };
}

async function setMessage(user1, user2, messageId) {
	await Challenge.updateOne({ user1, user2 }, { $set: { messageId } });
}

/* Ambil rekor menang/kalah (tidak mengubah apa pun) */
async function getRecord(a, b) {
	const [user1, user2] = pair(a, b);
	const doc = await Challenge.findOne({ user1, user2 }).lean();
	return { user1, user2, win1: doc?.win1 || 0, win2: doc?.win2 || 0, tie: doc?.tie || 0 };
}

/*
 * Tutup tantangan aktif milik user (terima/tolak) secara atomik: hanya satu pihak yang bisa menutupnya.
 * Return dokumen sebelum ditutup, atau null.
 */
async function close(userId, now = Date.now()) {
	return Challenge.findOneAndUpdate(
		{ $or: [{ user1: userId }, { user2: userId }], time: { $gt: fresh(now) } },
		{ $set: { time: null } },
		{ new: false }
	).lean();
}

/* Catat hasil: winnerId null = seri */
async function recordResult(a, b, winnerId) {
	const [user1, user2] = pair(a, b);
	let field = 'tie';
	if (winnerId) field = String(winnerId) === user1 ? 'win1' : 'win2';
	await Challenge.updateOne({ user1, user2 }, { $inc: { [field]: 1 } }, { upsert: true })
		.catch((error) => { if (error?.code !== 11000) throw error; });
}

/* Sedang punya tantangan aktif? (tidak boleh ganti team/senjata) */
async function inBattle(userId, now = Date.now()) {
	return !!(await findActive(userId, now));
}

/* Parse flag battle teman: display=text|compact|image, log|logs[=link], lvl=N */
function parseFlags(tokens) {
	const result = [];
	const used = new Set();
	const flags = tokens.join('').replace(/[=:]/g, '').replace(/,/g, '-').toLowerCase().split('-').filter(Boolean);
	for (const raw of flags) {
		let flag;
		if (raw.startsWith('display')) {
			const v = raw.replace('display', '');
			if (['text', 'compact', 'image'].includes(v)) flag = { key: 'display', res: v };
		} else if (raw.startsWith('log')) {
			flag = { key: 'log', res: raw.replace('logs', '').replace('log', '') === 'link' ? 'link' : 'log' };
		} else if (raw.startsWith('lvl') || raw.startsWith('level')) {
			const n = parseInt(raw.replace('level', '').replace('lvl', ''), 10);
			if (Number.isInteger(n)) flag = { key: 'lvl', res: `l${Math.min(100, Math.max(1, n))}` };
		}
		if (flag && !used.has(flag.key)) { used.add(flag.key); result.push(flag.res); }
	}
	return result.join(',');
}

function readFlags(flagString) {
	const result = {};
	for (const flag of String(flagString || '').split(',').filter(Boolean)) {
		if (flag === 'link' || flag === 'log') result.log = true;
		else if (['compact', 'image', 'text'].includes(flag)) result.display = flag;
		else if (/^l[0-9]+$/.test(flag)) result.level = parseInt(flag.substring(1), 10);
	}
	return result;
}

module.exports = { EXPIRE_MS, pair, findActive, create, setMessage, getRecord, close, recordResult, inBattle, parseFlags, readFlags };
