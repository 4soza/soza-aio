/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 */

const PassiveInterface = require('../PassiveInterface.js');
const WeaponInterface = require('../WeaponInterface.js');
const Log = require('../util/logUtil.js');

module.exports = class Safeguard extends PassiveInterface {
	init() {
		this.id = 11;
		this.name = 'Safeguard';
		this.basicDesc = '';
		this.emojis = Array(7).fill('🔒');
		this.statDesc = `Negate **?**% of the damage dealt to you with ${WeaponInterface.wpEmoji}WP`;
		this.qualityList = [[20, 40]];
	}

	attacked(animal, attacker, damage, type, tags) {
		if (tags.has('safeguard', animal)) return;

		let negate = (damage[0] * this.stats[0]) / 100;

		/* check if we have enough mana */
		if (animal.stats.wp[0] < negate) negate = animal.stats.wp[0];
		if (negate <= 0) return;

		let logs = new Log();

		const tagsCopy = tags.copyAdd('safeguard', animal);
		let mana = WeaponInterface.useMana(animal, negate, animal, tagsCopy);
		damage[1] -= mana.amount;

		logs.push(`[SGUARD] ${animal.nickname} used mana to negate ${mana.amount} damage`, mana.logs);

		return logs;
	}
};
