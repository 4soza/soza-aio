/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 */

const PassiveInterface = require('../PassiveInterface.js');
const Log = require('../util/logUtil.js');

module.exports = class Sprout extends PassiveInterface {
	init() {
		this.id = 17;
		this.name = 'Sprout';
		this.basicDesc = '';
		this.emojis = Array(7).fill('🌱');
		this.statDesc = 'Increase all incoming healing by **?%**';
		this.qualityList = [[20, 40]];
	}

	healed(animal, healer, amount, _tag) {
		let logs = new Log();

		// Bonus heals
		let bonus = amount[0] * (this.stats[0] / 100);
		amount[1] += bonus;

		logs.push(`[SPRT] ${animal.nickname} gained an additional ${Math.round(bonus)} HP`);

		return logs;
	}
};
