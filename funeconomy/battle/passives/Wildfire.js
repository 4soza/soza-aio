/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 * New weapon/passive designed for this bot (uses OwO's weapon framework).
 */

const PassiveInterface = require('../PassiveInterface.js');
const WeaponInterface = require('../WeaponInterface.js');
const Log = require('../util/logUtil.js');

module.exports = class Wildfire extends PassiveInterface {
	init() {
		this.id = 28;
		this.name = 'Wildfire';
		this.basicDesc = 'Attackers get burned';
		this.emojis = Array(7).fill('🔥');
		this.statDesc = `Reflect **?%** of the damage dealt to you as ${WeaponInterface.magEmoji}MAG damage`;
		this.qualityList = [[10, 30]];
	}

	postAttacked(animal, attacker, totalDamage, type, tags) {
		if (tags.has('wildfire', animal) || animal.stats.hp[0] <= 0) return;
		const damage = (totalDamage * this.stats[0]) / 100;
		if (damage < 1) return;
		const dmg = WeaponInterface.inflictDamage(animal, attacker, damage, WeaponInterface.MAGICAL, tags.copyAdd('wildfire', animal));
		const logs = new Log();
		logs.push(`[WFIRE] ${animal.nickname} burned ${attacker.nickname} for ${dmg.amount} HP`, dmg.logs);
		return logs;
	}
};
