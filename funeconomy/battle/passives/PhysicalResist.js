/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 */

const PassiveInterface = require('../PassiveInterface.js');
const WeaponInterface = require('../WeaponInterface.js');

/* +[5~20%] increase in physical resistance*/

module.exports = class PhysicalResistance extends PassiveInterface {
	init() {
		this.id = 5;
		this.name = 'Physical Resistance';
		this.basicDesc = 'Increases your Physical Resistance';
		this.emojis = Array(7).fill('🧱');
		this.statDesc = `Increases your ${WeaponInterface.prEmoji}PR by **?%**`;
		this.qualityList = [[15, 35]];
	}

	alterStats(stats) {
		let bonus = stats.pr[0] * (this.stats[0] / 100);
		stats.pr[1] += bonus;
	}
};
