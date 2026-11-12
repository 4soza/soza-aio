/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 */
const Weapon = require('../../models/funeconomy/weapon');
const Counter = require('../../models/funeconomy/counter');
const Crate = require('../../models/funeconomy/crate');
const WeaponInterface = require('./WeaponInterface.js');

const SELL_PRICES = { Common: 100, Uncommon: 250, Rare: 400, Epic: 600, Mythical: 5000, Legendary: 15000, Fabled: 50000 };
const SHARD_PRICES = { Common: 1, Uncommon: 3, Rare: 5, Epic: 25, Mythical: 300, Legendary: 1000, Fabled: 5000 };
const RANK_NAMES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Mythical', 'Legendary', 'Fabled'];
const RANK_ALIASES = [
	['common', 'cw', 'commonweapons', 'commonweapon'],
	['uncommon', 'uw', 'uncommonweapons', 'uncommonweapon'],
	['rare', 'rw', 'rareweapon', 'rareweapons'],
	['epic', 'ew', 'epicweapons', 'epicweapon'],
	['mythic', 'mythical', 'mw', 'mythicalweapons', 'mythicalweapon', 'mythicweapons', 'mythicweapon'],
	['legendary', 'lw', 'legendaryweapons', 'legendaryweapon'],
	['fabled', 'fable', 'fw', 'fabledweapons', 'fabledweapon', 'fableweapons', 'fableweapon']
];
const REROLL_PRICE = 100;
const MAX_RANK_BATCH = 500;

/* Rank index (0-6) dari alias seperti "cw" / "legendary"; -1 kalau bukan rank */
function rankFromAlias(token) {
	const t = String(token || '').toLowerCase();
	return RANK_ALIASES.findIndex((aliases) => aliases.includes(t));
}

const shortenUWID = (uwid) => WeaponInterface.shortenUWID(uwid);

/* base36 -> angka. Return undefined kalau tidak valid */
function expandUWID(token) {
	if (!token) return undefined;
	const t = String(token);
	if (t.length >= 10 || !/^[a-zA-Z0-9]+$/.test(t)) return undefined;
	const n = parseInt(t.toLowerCase(), 36);
	return Number.isSafeInteger(n) && n > 0 ? n : undefined;
}

/* Dokumen -> instance WeaponInterface (null kalau jenis senjata sudah tidak ada) */
function parseWeapon(doc) {
	if (!doc) return null;
	const WeaponClass = WeaponInterface.weapons[doc.wid];
	if (!WeaponClass) return null;
	const wear = doc.wear || 0;
	const passives = (doc.passives || []).map((p) => {
		const Passive = WeaponInterface.allPassives[p.id];
		return new Passive((p.stat || []).slice(), null, { wear });
	});
	const weapon = new WeaponClass(passives, (doc.stat || []).slice(), null, {
		wear,
		hasTT: !!doc.hasTT,
		kills: doc.kills || 0,
		rrCount: doc.rrCount || 0,
		rrAttempt: doc.rrAttempt || 0
	});
	weapon.ruwid = doc.uwid;
	weapon.uwid = shortenUWID(doc.uwid);
	weapon.userId = doc.userId;
	weapon.animalName = doc.animal || null;
	weapon.favorite = !!doc.favorite;
	return weapon;
}

function toDoc(weapon, userId, uwid) {
	return {
		uwid, userId, wid: weapon.id,
		stat: weapon.qualities.slice(),
		passives: weapon.passives.map((p) => ({ id: p.id, stat: p.qualities.slice() })),
		wear: weapon.wear?.id || 0,
		avg: weapon.avgQuality,
		rrCount: weapon.rrCount || 0,
		rrAttempt: weapon.rrAttempt || 0,
		hasTT: !!weapon.hasTT,
		kills: weapon.kills || 0,
		favorite: false,
		animal: null
	};
}

async function nextUwid() {
	const counter = await Counter.findOneAndUpdate(
		{ _id: 'weapon' }, { $inc: { seq: 1 } }, { new: true, upsert: true }
	).lean();
	return counter.seq;
}

/* Senjata random dari semua jenis yang aktif (atau wid tertentu) */
function randomWeapon(wid) {
	const all = WeaponInterface.weapons;
	let WeaponClass;
	if (wid) {
		WeaponClass = all[wid];
		if (!WeaponClass) throw new Error(`No weapon with id: ${wid}`);
	} else {
		const keys = Object.keys(all).filter((k) => !all[k].disabled);
		WeaponClass = all[keys[Math.floor(Math.random() * keys.length)]];
	}
	return new WeaponClass();
}

/* Simpan senjata baru milik user. Return instance dengan ruwid/uwid terisi. */
async function saveWeapon(userId, weapon) {
	const uwid = await nextUwid();
	await Weapon.create(toDoc(weapon, userId, uwid));
	weapon.ruwid = uwid;
	weapon.uwid = shortenUWID(uwid);
	weapon.userId = userId;
	weapon.favorite = false;
	weapon.animalName = null;
	return weapon;
}

async function getWeaponDoc(uwid, userId) {
	if (!uwid) return null;
	const filter = { uwid };
	if (userId) filter.userId = userId;
	return Weapon.findOne(filter).lean();
}

async function getWeapon(uwid, userId) {
	return parseWeapon(await getWeaponDoc(uwid, userId));
}

const SORTS = {
	id: { uwid: -1 },
	rarity: { avg: -1, uwid: -1 },
	type: { wid: -1, avg: -1, uwid: -1 },
	equipped: { animal: -1, uwid: -1 },
	favorite: { favorite: -1, avg: -1, uwid: -1 },
	tt: { kills: -1, uwid: -1 },
	wear: { wear: -1, avg: -1, uwid: -1 }
};

/* Satu halaman senjata. Return { docs, total } */
async function listWeapons(userId, { page = 0, perPage = 15, sort = 'id', wid, rank } = {}) {
	const filter = { userId };
	if (wid) filter.wid = wid;
	if (Number.isInteger(rank) && rank >= 0 && rank < WeaponInterface.ranks.length) {
		const { min, max, last } = rankBounds(rank);
		filter.avg = min === 0 ? { $gte: 0 } : { $gt: min };
		if (!last) filter.avg.$lte = max;
	}
	const total = await Weapon.countDocuments(filter);
	const docs = await Weapon.find(filter).sort(SORTS[sort] || SORTS.id).skip(page * perPage).limit(perPage).lean();
	return { docs, total };
}

/* Jumlah senjata per jenis (inventory): [{ wid, count }] */
async function countByType(userId) {
	const rows = await Weapon.aggregate([{ $match: { userId } }, { $group: { _id: '$wid', count: { $sum: 1 } } }]);
	return rows.map((r) => ({ wid: r._id, count: r.count }));
}

/* Pasang senjata ke hewan (hewan hanya boleh punya satu senjata). Return true bila berhasil. */
async function equip(userId, uwid, animalKey) {
	const updated = await Weapon.findOneAndUpdate(
		{ userId, uwid }, { $set: { animal: animalKey } }, { new: true }
	).lean();
	if (!updated) return null;
	await Weapon.updateMany({ userId, animal: animalKey, uwid: { $ne: uwid } }, { $set: { animal: null } });
	return updated;
}

/* Lepas senjata. Return dokumen sebelum dilepas, atau null */
async function unequip(userId, uwid) {
	return Weapon.findOneAndUpdate({ userId, uwid, animal: { $ne: null } }, { $set: { animal: null } }, { new: false }).lean();
}

async function setFavorite(userId, uwid, value) {
	return Weapon.findOneAndUpdate({ userId, uwid }, { $set: { favorite: !!value } }, { new: true }).lean();
}

async function addKills(uwid, amount) {
	if (!uwid || !(amount > 0)) return;
	await Weapon.updateOne({ uwid, hasTT: true }, { $inc: { kills: amount } });
}

/* Batas avg untuk sebuah rank: (min, max] */
function rankBounds(rankIndex) {
	let min = 0;
	let max = 0;
	for (let i = 0; i <= rankIndex; i++) {
		min = max;
		max += WeaponInterface.ranks[i][0];
	}
	return { min: min * 100, max: max * 100, last: rankIndex === WeaponInterface.ranks.length - 1 };
}

/*
 * Hapus satu senjata yang tidak dipakai & bukan favorit.
 * Return { weapon } kalau terhapus, atau { error } (equipped|favorite|unsellable|missing)
 */
async function removeWeapon(userId, uwid) {
	const doc = await getWeaponDoc(uwid, userId);
	const weapon = parseWeapon(doc);
	if (!weapon) return { error: 'missing' };
	if (doc.animal) return { error: 'equipped' };
	if (weapon.unsellable) return { error: 'unsellable' };
	if (doc.favorite) return { error: 'favorite' };
	const result = await Weapon.deleteOne({ userId, uwid, animal: null, favorite: { $ne: true } });
	if (!result.deletedCount) return { error: 'missing' };
	return { weapon };
}

/* Hapus semua senjata (maks 500) di satu rank yang tidak dipakai & bukan favorit. */
async function removeRank(userId, rankIndex) {
	const { min, max, last } = rankBounds(rankIndex);
	const avg = {};
	if (min === 0) avg.$gte = 0; else avg.$gt = min;
	if (!last) avg.$lte = max;
	const docs = await Weapon.find({ userId, animal: null, favorite: { $ne: true }, avg }).limit(MAX_RANK_BATCH).lean();
	const weapons = docs.map(parseWeapon).filter((w) => w && !w.unsellable);
	if (!weapons.length) return { weapons: [] };
	const ids = weapons.map((w) => w.ruwid);
	const result = await Weapon.deleteMany({ userId, uwid: { $in: ids }, animal: null, favorite: { $ne: true } });
	return { weapons: weapons.slice(0, result.deletedCount), deleted: result.deletedCount, rank: RANK_NAMES[rankIndex] };
}

/* Mulai reroll: bayar shard, hitung hasil baru, simpan sebagai pending. */
async function startReroll(userId, uwid, type, { free = false } = {}) {
	const doc = await getWeaponDoc(uwid, userId);
	const weapon = parseWeapon(doc);
	if (!weapon) return { error: 'missing' };
	if (weapon.unsellable || weapon.disableRR) return { error: 'disabled' };
	if (!free) {
		const paid = await Crate.findOneAndUpdate(
			{ userId, shards: { $gte: REROLL_PRICE } }, { $inc: { shards: -REROLL_PRICE } }, { new: true }
		).lean();
		if (!paid) return { error: 'shards' };
	}
	await Weapon.updateOne({ userId, uwid }, { $inc: { rrAttempt: 1 } });
	weapon.rrAttempt += 1;
	const next = type === 'p' ? weapon.rerollPassives() : weapon.rerollStats();
	next.ruwid = weapon.ruwid;
	next.uwid = weapon.uwid;
	await Weapon.updateOne({ userId, uwid }, {
		$set: {
			pending: {
				type, stat: next.qualities.slice(),
				passives: next.passives.map((p) => ({ id: p.id, stat: p.qualities.slice() })),
				wear: next.wear?.id || 0, avg: next.avgQuality, rrCount: next.rrCount, rrAttempt: next.rrAttempt
			}
		}
	});
	return { weapon, next };
}

/* Bangun instance weapon dari hasil reroll yang menunggu */
function pendingWeapon(doc) {
	if (!doc?.pending) return null;
	return parseWeapon({ ...doc, ...doc.pending, uwid: doc.uwid, userId: doc.userId });
}

async function confirmReroll(userId, uwid) {
	const doc = await getWeaponDoc(uwid, userId);
	if (!doc?.pending) return null;
	const p = doc.pending;
	return Weapon.findOneAndUpdate(
		{ userId, uwid, pending: { $ne: null } },
		{
			$set: { stat: p.stat, passives: p.passives, wear: p.wear, avg: p.avg, rrCount: p.rrCount, pending: null }
		},
		{ new: true }
	).lean();
}

async function cancelReroll(userId, uwid) {
	await Weapon.updateOne({ userId, uwid }, { $set: { pending: null } });
}

/* Senjata yang dipegang hewan-hewan tertentu (map animalKey -> doc) */
async function weaponsForAnimals(userId, names) {
	if (!names.length) return {};
	const docs = await Weapon.find({ userId, animal: { $in: names } }).lean();
	const map = {};
	for (const d of docs) map[d.animal] = d;
	return map;
}

module.exports = {
	SELL_PRICES, SHARD_PRICES, RANK_NAMES, REROLL_PRICE, SORTS,
	rankFromAlias, shortenUWID, expandUWID, parseWeapon, toDoc, nextUwid, randomWeapon, saveWeapon,
	getWeaponDoc, getWeapon, listWeapons, countByType, equip, unequip, setFavorite, addKills, rankBounds,
	removeWeapon, removeRank, startReroll, pendingWeapon, confirmReroll, cancelReroll, weaponsForAnimals
};
