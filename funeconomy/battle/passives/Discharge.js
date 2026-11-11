/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 */

const PassiveInterface = require('../PassiveInterface.js');
const WeaponInterface = require('../WeaponInterface.js');
const Log = require('../util/logUtil.js');

module.exports = class Discharge extends PassiveInterface {
	init() {
		this.id = 13;
		this.name = 'Discharge';
		this.basicDesc = '';
		this.emojis = Array(7).fill('🔋');
		this.statDesc = `When ${WeaponInterface.wpEmoji}WP is replenished, deal **?%** of the replenished amount to a random enemy as ${WeaponInterface.magEmoji}MAG damage`;
		this.qualityList = [[100, 140]];
	}

	postReplenished(animal, from, amount, tags) {
		/* Ignore if tags.thorns flag is true */
		if (tags.has('discharge', animal)) return;
		let totalDamage = (amount.reduce((a, b) => a + b, 0) * this.stats[0]) / 100;
		if (totalDamage < 1) return;

		let logs = new Log();

		/* Grab an enemy that I'm attacking */
		const enemies = tags.getAnimalEnemies(animal);
		const allies = tags.getAnimalAllies(animal);
		let attacking = WeaponInterface.getAttacking(animal, allies, enemies, { ignoreChoose: true });
		if (!attacking) return;

		const tagsCopy = tags.copyAdd('discharge', animal);
		let dmg = WeaponInterface.inflictDamage(
			animal,
			attacking,
			totalDamage,
			WeaponInterface.MAGICAL,
			tagsCopy
		);

		logs.push(
			`[DISCH] ${animal.nickname} damaged ${attacking.nickname} for ${dmg.amount} HP`,
			dmg.logs
		);

		return logs;
	}
};
