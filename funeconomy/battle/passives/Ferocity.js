/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 * New weapon/passive designed for this bot (uses OwO's weapon framework).
 */

const PassiveInterface = require('../PassiveInterface.js');
const WeaponInterface = require('../WeaponInterface.js');
const Log = require('../util/logUtil.js');

module.exports = class Ferocity extends PassiveInterface {
	init() {
		this.id = 26;
		this.name = 'Ferocity';
		this.basicDesc = 'Wounded animals fight harder';
		this.emojis = Array(7).fill('🐺');
		this.statDesc = 'While below **50%** HP, your attacks deal **?%** more damage';
		this.qualityList = [[15, 40]];
	}

	attack(animal, attackee, damage, _type, _tags) {
		const max = animal.stats.hp[1] + animal.stats.hp[3];
		if (animal.stats.hp[0] > max * 0.5) return;
		const extra = (damage[0] * this.stats[0]) / 100;
		damage[1] += extra;
		const logs = new Log();
		logs.push(`[FEROC] ${animal.nickname} dealt ${Math.round(extra)} extra damage`);
		return logs;
	}
};
