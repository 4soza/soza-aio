/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 */

const PassiveInterface = require('../PassiveInterface.js');
const WeaponInterface = require('../WeaponInterface.js');
const Log = require('../util/logUtil.js');

/* +[10~25%] thorns*/

module.exports = class Kamikaze extends PassiveInterface {
	init() {
		this.id = 14;
		this.name = 'Kamikaze';
		this.basicDesc = '';
		this.emojis = Array(7).fill('💥');
		this.statDesc = `When the animal dies, deal **?%** of its max ${WeaponInterface.hpEmoji}HP as ${WeaponInterface.magEmoji}MAG dmg to the attacker`;
		this.qualityList = [[50, 75]];
	}

	postAttacked(animal, attacker, totalDamage, type, tags) {
		if (tags.has('kamikaze', animal)) return;
		// Only active when dead
		if (animal.stats.hp[0] > 0) return;

		let logs = new Log();

		let dmg = WeaponInterface.getDamageFromHpWp(animal.stats.hp, this.stats[0] / 100);
		const tagsCopy = tags.copyAdd('kamikaze', animal);
		dmg = WeaponInterface.inflictDamage(animal, attacker, dmg, WeaponInterface.MAGICAL, tagsCopy);

		logs.push(
			`[KKAZE] ${animal.nickname} died and damaged ${attacker.nickname} for ${dmg.amount} HP`,
			dmg.logs
		);

		return logs;
	}
};
