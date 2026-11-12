/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 * New weapon/passive designed for this bot (uses OwO's weapon framework).
 */

const PassiveInterface = require('../PassiveInterface.js');
const WeaponInterface = require('../WeaponInterface.js');
const Log = require('../util/logUtil.js');

module.exports = class Sharpness extends PassiveInterface {
	init() {
		this.id = 27;
		this.name = 'Sharpness';
		this.basicDesc = 'Honed to a fine edge';
		this.emojis = Array(7).fill('🗡️');
		this.statDesc = `Increases your ${WeaponInterface.strEmoji}STR and ${WeaponInterface.magEmoji}MAG by **?%**`;
		this.qualityList = [[5, 15]];
	}

	alterStats(stats) {
		stats.att[1] += stats.att[0] * (this.stats[0] / 100);
		stats.mag[1] += stats.mag[0] * (this.stats[0] / 100);
	}
};
