/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 */

const PassiveInterface = require('../PassiveInterface.js');
const Log = require('../util/logUtil.js');

module.exports = class Critical extends PassiveInterface {
	init() {
		this.id = 12;
		this.name = 'Critical';
		this.basicDesc = '';
		this.emojis = Array(7).fill('🎯');
		this.statDesc =
			'Every attack has a **?%** chance to deal **?%** more damage. This can apply to heals.';
		this.qualityList = [
			[10, 30],
			[25, 50],
		];
	}

	attack(animal, attackee, damage, _type, _tags) {
		if (Math.random() * 100 > this.stats[0]) return;

		let logs = new Log();

		let extraDamage = (damage[0] * this.stats[1]) / 100;
		damage[1] += extraDamage;

		logs.push(`[CRIT] ${animal.nickname} dealt ${Math.round(extraDamage)} extra damage`);
		return logs;
	}

	heal(animal, healer, amount, _tag) {
		if (Math.random() * 100 > this.stats[0]) return;

		let logs = new Log();

		let extraHeal = (amount[0] * this.stats[1]) / 100;
		amount[1] += extraHeal;

		logs.push(`[CRIT] ${animal.nickname} healed ${Math.round(extraHeal)} extra health`);
		return logs;
	}
};
