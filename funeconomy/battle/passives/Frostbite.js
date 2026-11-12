/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 * New weapon/passive designed for this bot (uses OwO's weapon framework).
 */

const PassiveInterface = require('../PassiveInterface.js');
const WeaponInterface = require('../WeaponInterface.js');
const Log = require('../util/logUtil.js');

module.exports = class Frostbite extends PassiveInterface {
	init() {
		this.id = 29;
		this.name = 'Frostbite';
		this.basicDesc = 'A cold shell protects you';
		this.emojis = Array(7).fill('❄️');
		this.statDesc = `Increases your ${WeaponInterface.prEmoji}PR and ${WeaponInterface.mrEmoji}MR by **?%**`;
		this.qualityList = [[5, 15]];
	}

	alterStats(stats) {
		stats.pr[1] += stats.pr[0] * (this.stats[0] / 100);
		stats.mr[1] += stats.mr[0] * (this.stats[0] / 100);
	}
};
