/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 */
const WeaponInterface = require('./WeaponInterface.js');

/* Hitung stat battle seorang hewan dari xp (dan senjata). level = paksa level (battle teman). */
exports.stats = function (animal, level) {
	const lvl = exports.toLvl(animal.xp || 0);
	if (level) lvl.lvl = level;
	const stats = exports.parseStats(animal.animal, lvl.lvl);

	stats.lvl = lvl.lvl;
	stats.xp = [lvl.currentXp, lvl.maxXp];

	if (animal.weapon) animal.weapon.alterStats(stats);

	/* Make sure bonus hp/wp is added */
	stats.hp[0] = stats.hp[1] + stats.hp[3];
	stats.wp[0] = stats.wp[1] + stats.wp[3];

	stats.mrp = WeaponInterface.resToPrettyPercent(stats.mr[0] + stats.mr[1]);
	stats.prp = WeaponInterface.resToPrettyPercent(stats.pr[0] + stats.pr[1]);

	animal.stats = stats;
};

/* Parse animal stats based on level */
exports.parseStats = function (animal, lvl) {
	const stats = {};
	const baseHp = 500 + lvl * (animal.hpr * 2);
	stats.hp = [baseHp, baseHp, baseHp, 0];
	const baseWp = 500 + lvl * (animal.wpr * 2);
	stats.wp = [baseWp, baseWp, baseWp, 0];
	stats.att = [100 + lvl * animal.attr, 0];
	stats.mag = [100 + lvl * animal.magr, 0];
	stats.pr = [25 + lvl * animal.prr * 2, 0];
	stats.mr = [25 + lvl * animal.mrr * 2, 0];
	return stats;
};

/* xp yang dibutuhkan untuk naik dari level ini */
const getXP = (lvl) => Math.pow(lvl, 4) + 1000;
exports.getXP = getXP;

/* Converts total xp to level */
exports.toLvl = function (xp) {
	let lvl = 1;
	while (xp >= getXP(lvl)) {
		xp -= getXP(lvl);
		lvl++;
	}
	return { lvl, currentXp: xp, maxXp: getXP(lvl) };
};

/* Total xp minimum untuk mencapai sebuah level */
exports.xpForLevel = function (level) {
	let total = 0;
	for (let i = 1; i < level; i++) total += getXP(i);
	return total;
};

const barLength = 24;
/* HP bar (█/▁) di atas, WP bar (▰/▱) di bawah */
exports.bar = function (stats) {
	let bar = '';
	const hp = Math.max(0, Math.ceil(barLength * (stats.hp[0] / (stats.hp[1] + stats.hp[3]))));
	for (let i = 0; i < barLength; i++) bar += i < hp ? '█' : '▁';
	bar += '\n';
	const wp = Math.max(0, Math.ceil(barLength * (stats.wp[0] / (stats.wp[1] + stats.wp[3]))));
	for (let i = 0; i < barLength; i++) bar += i < wp ? '▰' : '▱';
	return bar;
};
