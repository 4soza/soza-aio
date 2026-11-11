/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 */

const PassiveInterface = require('../PassiveInterface.js');
const WeaponInterface = require('../WeaponInterface.js');

/* +[5~20%] increase in hp*/

module.exports = class HealthPoint extends PassiveInterface {
	init() {
		this.id = 3;
		this.name = 'Health Point';
		this.basicDesc = 'Increases your Health Points';
		this.emojis = Array(7).fill('❤️');
		this.statDesc = `Increases your ${WeaponInterface.hpEmoji}HP by **?%**`;
		this.qualityList = [[5, 20]];
	}

	alterStats(stats) {
		let bonus = stats.hp[1] * (this.stats[0] / 100);
		stats.hp[3] += bonus;
	}
};
