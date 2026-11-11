/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 */

const BuffInterface = require('../BuffInterface.js');
const Logs = require('../util/logUtil.js');

module.exports = class Taunt extends BuffInterface {
	init() {
		this.id = 1;
		this.name = 'Taunt';
		this.debuff = false;
		this.emoji = '📢';
		this.statDesc =
			'Taunts the enemy team and forces all opponents to attack this animal. Reduces incoming damage by **?**%';
		this.qualityList = [[30, 50]];
	}

	enemyChooseAttack(animal, _attacker, _ally, _enemy) {
		if (animal.stats.hp[0] > 0) return animal;
	}

	attacked(animal, attacker, damage, _type, _last) {
		let logs = new Logs();

		let negate = ((damage[0] + damage[1]) * this.stats[0]) / 100;
		damage[1] -= negate;

		logs.push(`[TAUNT] ${animal.nickname} negated ${Math.round(negate)} damage`);
		return logs;
	}
};
