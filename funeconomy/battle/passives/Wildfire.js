/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 * New weapon/passive designed for this bot (uses OwO's weapon framework).
 */

// Giant Slayer: nama kelas tetap "Wildfire" supaya nama emoji (p_wildfire_*) dan id passive (28) tidak berubah.
const PassiveInterface = require('../PassiveInterface.js');
const Log = require('../util/logUtil.js');

module.exports = class Wildfire extends PassiveInterface {
	init() {
		this.id = 28;
		this.name = 'Giant Slayer';
		this.aliases = ['gslay', 'slay', 'slayer'];
		this.basicDesc = 'Deal more damage to bosses';
		this.emojis = Array(7).fill('🔥');
		this.statDesc = 'Deal **?%** more damage to bosses.';
		this.qualityList = [[10, 25]];
	}

	attack(animal, attackee, damage, _type, _tags) {
		if (!attackee.isBoss) return;
		const extra = (damage[0] * this.stats[0]) / 100;
		if (extra < 1) return;
		damage[1] += extra;
		const logs = new Log();
		logs.push(`[GSLAY] ${animal.nickname} dealt ${Math.round(extra)} extra damage to the boss`);
		return logs;
	}
};
