/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 */

const PassiveInterface = require('../PassiveInterface.js');
const WeaponInterface = require('../WeaponInterface.js');
const Log = require('../util/logUtil.js');

module.exports = class Snail extends PassiveInterface {
	init() {
		this.id = 20;
		this.name = 'Snail';
		this.basicDesc = '';
		this.emojis = Array(7).fill('🐌');
		this.statDesc =
			'Your pet snail fights with you. Whenever you attack an animal, snail will slap a random enemy for **?%** of the damage dealt.';
		this.qualityList = [[5, 15]];
	}

	postAttack(animal, _attackee, damage, type, tags) {
		if (tags.has('snail', animal)) return;
		let logs = new Log();

		let snailDamage = (damage * this.stats[0]) / 100;

		/* Grab an enemy that I'm attacking */
		const allies = tags.getAnimalAllies(animal);
		const enemies = tags.getAnimalEnemies(animal);
		let attacking = WeaponInterface.getAttacking(animal, allies, enemies, { ignoreChoose: true });
		if (!attacking) return;

		const copyTags = tags.copyAdd('snail', animal, {
			me: animal,
			allies: tags.allies,
			enemies: tags.enemies,
		});
		// damage variable already has res applied, no need to recalculate res twice.
		snailDamage = WeaponInterface.inflictDamage(animal, attacking, snailDamage, type, copyTags, {
			bypassRes: true,
		});
		logs.push(
			`[SNAIL] ${animal.nickname}'s pet snail slapped ${attacking.nickname} for ${snailDamage.amount} HP`,
			snailDamage.logs
		);

		return logs;
	}
};
