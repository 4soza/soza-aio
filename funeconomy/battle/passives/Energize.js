/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 */

const PassiveInterface = require('../PassiveInterface.js');
const WeaponInterface = require('../WeaponInterface.js');
const Log = require('../util/logUtil.js');

module.exports = class Energize extends PassiveInterface {
	init() {
		this.id = 16;
		this.name = 'Energize';
		this.basicDesc = '';
		this.emojis = Array(7).fill('🔆');
		this.statDesc = `Replenish **?** ${WeaponInterface.wpEmoji}WP after every turn`;
		this.qualityList = [[20, 40]];
	}

	postTurn(animal, ally, enemy, _action) {
		if (animal.stats.hp[0] <= 0) return;

		if (animal.stats.wp[0] >= animal.stats.wp[1] + animal.stats.wp[3]) return;

		let logs = new Log();
		let replenish = this.stats[0];
		replenish = WeaponInterface.replenish(animal, replenish, animal, {
			me: animal,
			allies: ally,
			enemies: enemy,
		});
		logs.push(`[ENERG] ${animal.nickname} replenished ${replenish.amount} WP`, replenish.logs);

		return logs;
	}
};
