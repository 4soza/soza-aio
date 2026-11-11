/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 */

const BuffInterface = require('../BuffInterface.js');
const Logs = require('../util/logUtil.js');

module.exports = class AttackUp extends BuffInterface {
	init() {
		this.id = 7;
		this.name = 'Attack Up+';
		this.debuff = false;
		this.emoji = '⏫';
		this.statDesc = 'Increases all damage by **?%**. Cannot stack with other Attack Up+ buffs';
		this.qualityList = [[25, 35]];
	}

	// Override
	bind(animal, duration, tags) {
		for (let i in animal.buffs) {
			if (animal.buffs[i].id == this.id) {
				animal.buffs[i].duration += duration;
				this.justCreated = true;
				return;
			}
		}

		super.bind(animal, duration, tags);
	}

	attack(animal, attackee, damage, _type, _last) {
		if (this.markedForDeath) return;
		let logs = new Logs();

		let bonus = damage[0] * (this.stats[0] / 100);
		damage[1] += bonus;

		logs.push(`[ATTUP+] ${animal.nickname} dealt ${Math.round(bonus)} bonus damage`);
		return logs;
	}
};
