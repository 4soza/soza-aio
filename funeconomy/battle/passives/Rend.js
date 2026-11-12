/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 * New weapon/passive designed for this bot (uses OwO's weapon framework).
 */

const PassiveInterface = require('../PassiveInterface.js');
const WeaponInterface = require('../WeaponInterface.js');
const Log = require('../util/logUtil.js');

module.exports = class Rend extends PassiveInterface {
	init() {
		this.id = 22;
		this.name = 'Rend';
		this.basicDesc = 'Your hits tear deeper';
		this.emojis = Array(7).fill('🐾');
		this.statDesc = 'Every attack also deals **?%** of the damage dealt as true damage';
		this.qualityList = [[10, 25]];
	}

	postAttack(animal, attackee, totalDamage, type, tags) {
		if (tags.has('rend', animal) || animal.stats.hp[0] <= 0 || attackee.stats.hp[0] <= 0) return;
		const damage = (totalDamage * this.stats[0]) / 100;
		if (damage < 1) return;
		const dmg = WeaponInterface.inflictDamage(animal, attackee, damage, WeaponInterface.TRUE, tags.copyAdd('rend', animal));
		const logs = new Log();
		logs.push(`[REND] ${animal.nickname} tore ${attackee.nickname} for ${dmg.amount} HP`, dmg.logs);
		return logs;
	}
};
