/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 */

const PassiveInterface = require('../PassiveInterface.js');
const WeaponInterface = require('../WeaponInterface.js');

/* +[5~20%] increase in magic*/

module.exports = class Magic extends PassiveInterface {
	init() {
		this.id = 2;
		this.name = 'Magic';
		this.basicDesc = 'Increases your Magic';
		this.emojis = Array(7).fill('🧙');
		this.statDesc = `Increases your ${WeaponInterface.magEmoji}MAG by **?%**`;
		this.qualityList = [[5, 20]];
	}

	alterStats(stats) {
		let bonus = stats.mag[0] * (this.stats[0] / 100);
		stats.mag[1] += bonus;
	}
};
