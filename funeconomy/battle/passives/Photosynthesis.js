/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 * New weapon/passive designed for this bot (uses OwO's weapon framework).
 */

const PassiveInterface = require('../PassiveInterface.js');
const WeaponInterface = require('../WeaponInterface.js');
const Log = require('../util/logUtil.js');

module.exports = class Photosynthesis extends PassiveInterface {
	init() {
		this.id = 24;
		this.name = 'Photosynthesis';
		this.basicDesc = 'Grow back from the roots';
		this.emojis = Array(7).fill('🌿');
		this.statDesc = 'Heal **?%** of your missing ' + WeaponInterface.hpEmoji + 'HP after every turn';
		this.qualityList = [[10, 25]];
	}

	postTurn(animal, ally, enemy, _action) {
		if (animal.stats.hp[0] <= 0) return;
		const max = animal.stats.hp[1] + animal.stats.hp[3];
		const missing = max - animal.stats.hp[0];
		const amount = (missing * this.stats[0]) / 100;
		if (amount < 1) return;
		const heal = WeaponInterface.heal(animal, amount, animal, { me: animal, allies: ally, enemies: enemy });
		const logs = new Log();
		logs.push(`[PHOTO] ${animal.nickname} heals for ${heal.amount} HP`, heal.logs);
		return logs;
	}
};
