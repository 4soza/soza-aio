/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 */

const PassiveInterface = require('../PassiveInterface.js');
const WeaponInterface = require('../WeaponInterface.js');
const Log = require('../util/logUtil.js');

module.exports = class Regeneration extends PassiveInterface {
	init() {
		this.id = 15;
		this.name = 'Regeneration';
		this.basicDesc = '';
		this.emojis = Array(7).fill('💚');
		this.statDesc = 'Heal **?%** of your max ' + WeaponInterface.hpEmoji + 'HP after every turn';
		this.qualityList = [[5, 10]];
	}

	postTurn(animal, ally, enemy, _action) {
		if (animal.stats.hp[0] <= 0) return;

		let logs = new Log();
		let heal = (animal.stats.hp[1] + animal.stats.hp[3]) * (this.stats[0] / 100);
		heal = WeaponInterface.heal(animal, heal, animal, {
			me: animal,
			allies: ally,
			enemies: enemy,
		});
		logs.push(`[REGEN] ${animal.nickname} heals for ${heal.amount} HP`, heal.logs);

		return logs;
	}
};
