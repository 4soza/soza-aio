/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 */

const PassiveInterface = require('../PassiveInterface.js');
const WeaponInterface = require('../WeaponInterface.js');
const Log = require('../util/logUtil.js');

module.exports = class ManaTap extends PassiveInterface {
	init() {
		this.id = 9;
		this.name = 'Mana Tap';
		this.basicDesc = '';
		this.emojis = Array(7).fill('🚰');
		this.statDesc =
			'All damage you deal replenishes your ' +
			WeaponInterface.wpEmoji +
			'WP for **?%** of the damage dealt!';
		this.qualityList = [[15, 30]];
	}

	postAttack(animal, attackee, totalDamage, type, tags) {
		let logs = new Log();

		let mana = (totalDamage * this.stats[0]) / 100;
		mana = WeaponInterface.replenish(animal, mana, animal, tags);

		logs.push(`[MTAP] ${animal.nickname} replenished ${mana.amount} WP`, mana.logs);
		return logs;
	}
};
