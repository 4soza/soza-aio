/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 */

const PassiveInterface = require('../PassiveInterface.js');
const WeaponInterface = require('../WeaponInterface.js');

/* +[5~20%] increase in wp*/

module.exports = class WeaponPoint extends PassiveInterface {
	init() {
		this.id = 4;
		this.name = 'Weapon Point';
		this.basicDesc = 'Increases your Weapon Points';
		this.emojis = Array(7).fill('💙');
		this.statDesc = `Increases your ${WeaponInterface.wpEmoji}WP by **?%**`;
		this.qualityList = [[10, 30]];
	}

	alterStats(stats) {
		let bonus = stats.wp[1] * (this.stats[0] / 100);
		stats.wp[3] += bonus;
	}
};
