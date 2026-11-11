/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 */

const PassiveInterface = require('../PassiveInterface.js');
const WeaponInterface = require('../WeaponInterface.js');

/* +[5~20%] increase in magical resistance*/

module.exports = class MagicalResistance extends PassiveInterface {
	init() {
		this.id = 6;
		this.name = 'Magical Resistance';
		this.basicDesc = 'Increases your Magical Resistance';
		this.emojis = Array(7).fill('🌀');
		this.statDesc = `Increases your ${WeaponInterface.mrEmoji}MR by **?%**`;
		this.qualityList = [[15, 35]];
	}

	alterStats(stats) {
		let bonus = stats.mr[0] * (this.stats[0] / 100);
		stats.mr[1] += bonus;
	}
};
