/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 * New weapon/passive designed for this bot (uses OwO's weapon framework).
 */

const PassiveInterface = require('../PassiveInterface.js');
const WeaponInterface = require('../WeaponInterface.js');
const Log = require('../util/logUtil.js');

module.exports = class Execute extends PassiveInterface {
	init() {
		this.id = 23;
		this.name = 'Execute';
		this.basicDesc = 'Finish off weak enemies';
		this.emojis = Array(7).fill('🩸');
		this.statDesc = 'Attacks against enemies below **30%** HP deal **?%** of the damage dealt as extra true damage';
		this.qualityList = [[20, 50]];
	}

	postAttack(animal, attackee, totalDamage, type, tags) {
		if (tags.has('execute', animal) || animal.stats.hp[0] <= 0 || attackee.stats.hp[0] <= 0) return;
		const max = attackee.stats.hp[1] + attackee.stats.hp[3];
		if (attackee.stats.hp[0] > max * 0.3) return;
		const damage = (totalDamage * this.stats[0]) / 100;
		if (damage < 1) return;
		const dmg = WeaponInterface.inflictDamage(animal, attackee, damage, WeaponInterface.TRUE, tags.copyAdd('execute', animal));
		const logs = new Log();
		logs.push(`[EXEC] ${animal.nickname} executed ${attackee.nickname} for ${dmg.amount} HP`, dmg.logs);
		return logs;
	}
};
