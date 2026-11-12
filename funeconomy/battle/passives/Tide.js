/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 * New weapon/passive designed for this bot (uses OwO's weapon framework).
 */

const PassiveInterface = require('../PassiveInterface.js');
const WeaponInterface = require('../WeaponInterface.js');
const Log = require('../util/logUtil.js');

module.exports = class Tide extends PassiveInterface {
	init() {
		this.id = 25;
		this.name = 'Tide';
		this.basicDesc = 'Mana flows back to you';
		this.emojis = Array(7).fill('🌊');
		this.statDesc = 'Replenish **?%** of your max ' + WeaponInterface.wpEmoji + 'WP after every turn';
		this.qualityList = [[5, 12]];
	}

	postTurn(animal, ally, enemy, _action) {
		if (animal.stats.hp[0] <= 0) return;
		const max = animal.stats.wp[1] + animal.stats.wp[3];
		const amount = (max * this.stats[0]) / 100;
		if (amount < 1) return;
		const mana = WeaponInterface.replenish(animal, amount, animal, { me: animal, allies: ally, enemies: enemy });
		if (!mana.amount) return;
		const logs = new Log();
		logs.push(`[TIDE] ${animal.nickname} replenished ${mana.amount} WP`, mana.logs);
		return logs;
	}
};
