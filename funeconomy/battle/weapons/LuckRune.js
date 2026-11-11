/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 */

const WeaponInterface = require('../WeaponInterface.js');
const Logs = require('../util/logUtil.js');

module.exports = class LuckRune extends WeaponInterface {
	init() {
		this.id = 22;
		this.disabled = true;
		this.name = 'Rune of Luck';
		this.basicDesc = '';
		this.emojis = Array(7).fill('🍀');
		this.pristineEmojis = Array(7).fill('🍀');
		this.defaultEmoji = '🍀';
		this.statDesc =
			'Punches a random enemy 5 times. Each punch randomly deals either a percentage of your ' +
			WeaponInterface.strEmoji +
			'STR or ' +
			WeaponInterface.magEmoji +
			'MAG. Punches deals: **?%**, **?%**, **?%**, **?%**, **?%**';
		this.availablePassives = 'all';
		this.passiveCount = 1;
		this.qualityList = [
			[1, 40],
			[1, 40],
			[1, 40],
			[1, 40],
			[1, 40],
		];
		this.manaRange = [200, 100];
	}

	attackWeapon(me, team, enemy) {
		if (me.stats.hp[0] <= 0) return;

		/* No mana */
		if (me.stats.wp[0] < this.manaCost) return this.attackPhysical(me, team, enemy);

		/* Grab an enemy that I'm attacking */
		let attacking = WeaponInterface.getAttacking(me, team, enemy);
		if (!attacking) return;

		let logs = new Logs();

		/* deplete weapon points*/
		let mana = WeaponInterface.useMana(me, this.manaCost, me, {
			me,
			allies: team,
			enemies: enemy,
		});
		let manaLogs = new Logs();
		manaLogs.push(`[LRUNE] ${me.nickname} used ${mana.amount} WP`, mana.logs);

		let damageLogs = new Logs();
		let physDamage = 0;
		let magDamage = 0;
		for (let i = 0; i < 5; i++) {
			let damage;
			if (Math.random() < 0.5) {
				/* Calculate damage */
				damage = WeaponInterface.getDamage(me.stats.att, this.stats[i] / 100);
				/* Deal damage */
				damage = WeaponInterface.inflictDamage(me, attacking, damage, WeaponInterface.PHYSICAL, {
					me,
					allies: team,
					enemies: enemy,
				});
				physDamage += damage.amount;
			} else {
				/* Calculate damage */
				damage = WeaponInterface.getDamage(me.stats.mag, this.stats[i] / 100);
				/* Deal damage */
				damage = WeaponInterface.inflictDamage(me, attacking, damage, WeaponInterface.MAGICAL, {
					me,
					allies: team,
					enemies: enemy,
				});
				magDamage += damage.amount;
			}
			damageLogs.push(damage.logs);
		}

		logs.push(
			`[LRUNE] ${me.nickname} damaged ${attacking.nickname} for a total of ${physDamage} physical and ${magDamage} magical damage.`,
			damageLogs
		);

		logs.addSubLogs(manaLogs);

		return logs;
	}
};
