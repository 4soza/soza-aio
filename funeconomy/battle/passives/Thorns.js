/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 */

const PassiveInterface = require('../PassiveInterface.js');
const WeaponInterface = require('../WeaponInterface.js');
const Log = require('../util/logUtil.js');

/* +[10~25%] thorns*/

module.exports = class Thorns extends PassiveInterface {
	init() {
		this.id = 8;
		this.name = 'Thorns';
		this.basicDesc = 'Reflect a percent of the damage dealt to you!';
		this.emojis = Array(7).fill('🌹');
		this.statDesc = 'Reflect **?**% of the damage dealt to you as true damage';
		this.qualityList = [[15, 35]];
	}

	postAttacked(animal, attacker, totalDamage, type, tags) {
		/* Ignore if tags.thorns flag is true */
		if (tags.has('thorns', animal)) return;
		if (animal.stats.hp[0] <= 0) return;
		let damage = (totalDamage * this.stats[0]) / 100;
		if (damage < 1) return;

		let logs = new Log();

		const tagsCopy = tags.copyAdd('thorns', animal);
		let dmg = WeaponInterface.inflictDamage(
			animal,
			attacker,
			damage,
			WeaponInterface.TRUE,
			tagsCopy
		);

		logs.push(
			`[THORNS] ${animal.nickname} damaged ${attacker.nickname} for ${dmg.amount} HP`,
			dmg.logs
		);

		return logs;
	}
};
