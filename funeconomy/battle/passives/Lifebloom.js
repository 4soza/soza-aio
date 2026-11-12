/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 * New weapon/passive designed for this bot (uses OwO's weapon framework).
 */

const PassiveInterface = require('../PassiveInterface.js');
const WeaponInterface = require('../WeaponInterface.js');
const Log = require('../util/logUtil.js');

module.exports = class Lifebloom extends PassiveInterface {
	init() {
		this.id = 30;
		this.name = 'Lifebloom';
		this.basicDesc = 'Your attacks nurture your team';
		this.emojis = Array(7).fill('🌸');
		this.statDesc = 'All damage you deal heals the ally with the lowest HP for **?%** of the damage dealt';
		this.qualityList = [[10, 25]];
	}

	postAttack(animal, attackee, totalDamage, type, tags) {
		if (tags.has('lifebloom', animal) || animal.stats.hp[0] <= 0) return;
		const allies = tags.getAnimalAllies(animal);
		const lowest = WeaponInterface.getLowestHp(allies);
		if (!lowest) return;
		const amount = (totalDamage * this.stats[0]) / 100;
		if (amount < 1) return;
		const heal = WeaponInterface.heal(lowest, amount, animal, tags.copyAdd('lifebloom', animal));
		const logs = new Log();
		logs.push(`[LBLOOM] ${animal.nickname} healed ${lowest.nickname} for ${heal.amount} HP`, heal.logs);
		return logs;
	}
};
