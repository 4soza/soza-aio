/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 */

const PassiveInterface = require('../PassiveInterface.js');
const Log = require('../util/logUtil.js');

module.exports = class Enrage extends PassiveInterface {
	init() {
		this.id = 18;
		this.name = 'Enrage';
		this.basicDesc = '';
		this.emojis = Array(7).fill('😡');
		this.statDesc = 'Every 10% of missing health gives +**?%** damage';
		this.qualityList = [[1, 4]];
	}

	attack(animal, attackee, damage, _type, _tags) {
		let maxHP = animal.stats.hp[1] + animal.stats.hp[3];
		let currentHP = animal.stats.hp[0];
		if (currentHP >= maxHP) return;

		let logs = new Log();

		let percentMissing = (1 - currentHP / maxHP) * (100 / 10);
		let extraDamage = damage[0] * (this.stats[0] / 100) * percentMissing;
		if (Math.floor(extraDamage) <= 0) return;
		damage[1] += extraDamage;

		logs.push(`[ENRA] ${animal.nickname} dealt ${Math.round(extraDamage)} extra damage`);
		return logs;
	}
};
