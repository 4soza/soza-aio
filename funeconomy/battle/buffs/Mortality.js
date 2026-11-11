/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 */

const BuffInterface = require('../BuffInterface.js');
const Logs = require('../util/logUtil.js');

module.exports = class Mortality extends BuffInterface {
	init() {
		this.id = 9;
		this.name = 'Mortality';
		this.debuff = true;
		this.emoji = '⌛';
		this.statDesc = 'Decreases all healing for this animal by **?%**';
		this.qualityList = [[45, 75]];
	}

	// Override
	bind(animal, duration, tags) {
		for (let i in animal.buffs) {
			if (animal.buffs[i].id == this.id) {
				animal.buffs[i].duration += duration;
				return;
			}
		}

		super.bind(animal, duration, tags);
	}

	healed(animal, healer, amount, _tag) {
		let logs = new Logs();

		let dec = amount[0] * (this.stats[0] / 100);
		amount[1] -= dec;

		logs.push(`[MORT] Healing was decreased by ${Math.round(dec)}`);
		return logs;
	}
};
