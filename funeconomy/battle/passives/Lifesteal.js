/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 */

const PassiveInterface = require('../PassiveInterface.js');
const WeaponInterface = require('../WeaponInterface.js');
const Log = require('../util/logUtil.js');

/* +[10~25%] lifesteal*/

module.exports = class Lifesteal extends PassiveInterface {
	init() {
		this.id = 7;
		this.name = 'Lifesteal';
		this.basicDesc = 'All attacks heal you!';
		this.emojis = Array(7).fill('🦇');
		this.statDesc = 'All damage you deal heals you for **?%** of the damage dealt!';
		this.qualityList = [[15, 35]];
	}

	postAttack(animal, attackee, totalDamage, type, tags) {
		if (tags.has('lifesteal', animal) || tags.has('kamikaze', animal) || animal.stats.hp[0] <= 0)
			return;

		let logs = new Log();
		let heal = (totalDamage * this.stats[0]) / 100;
		const tagsCopy = tags.copyAdd('lifesteal', animal);
		heal = WeaponInterface.heal(animal, heal, animal, tagsCopy);

		logs.push(`[LIFESTEAL] ${animal.nickname} heals for ${heal.amount} HP`, heal.logs);
		return logs;
	}
};
