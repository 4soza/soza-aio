/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 */

const PassiveInterface = require('../PassiveInterface.js');
const WeaponInterface = require('../WeaponInterface.js');

/* +[5~20%] increase in strength */

module.exports = class Strength extends PassiveInterface {
	init() {
		this.id = 1;
		this.name = 'Strength';
		this.basicDesc = 'Increases your Strength';
		this.emojis = Array(7).fill('💪');
		this.statDesc = `Increases your ${WeaponInterface.strEmoji}STR by **?%**`;
		this.qualityList = [[5, 20]];
	}

	alterStats(stats) {
		let bonus = stats.att[0] * (this.stats[0] / 100);
		stats.att[1] += bonus;
	}
};
