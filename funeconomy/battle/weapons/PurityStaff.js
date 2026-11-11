/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 */

const WeaponInterface = require('../WeaponInterface.js');
const Logs = require('../util/logUtil.js');

module.exports = class PStaff extends WeaponInterface {
	init() {
		this.id = 19;
		this.name = 'Staff of Purity';
		this.basicDesc = '';
		this.emojis = Array(7).fill('💧');
		this.pristineEmojis = Array(7).fill('💧');
		this.defaultEmoji = '💧';
		this.statDesc = `Remove a buff from an enemy. If successful, deal **?%** of your ${WeaponInterface.magEmoji}MAG to them. Remove a debuff from an ally. If successful, heal **?%** of your ${WeaponInterface.strEmoji}STR to them.`;
		this.availablePassives = 'all';
		this.passiveCount = 1;
		this.qualityList = [
			[50, 100],
			[50, 100],
		];
		this.manaRange = [200, 125];
	}

	attackWeapon(me, team, enemy) {
		if (me.stats.hp[0] <= 0) return;

		/* No mana */
		if (me.stats.wp[0] < this.manaCost) return this.attackPhysical(me, team, enemy);

		/* Grab enemy with buff and ally with debuff */
		let attacking = WeaponInterface.getAttacking(me, team, enemy, { hasBuff: true });
		let ally = WeaponInterface.getRandomAnimal(team, { hasDebuff: true, isAlive: true });
		if (!attacking && !ally) return this.attackPhysical(me, team, enemy);

		let logs = new Logs();

		/* deplete weapon points*/
		let mana = WeaponInterface.useMana(me, this.manaCost, me, {
			me,
			allies: team,
			enemies: enemy,
		});
		let manaLogs = new Logs();
		manaLogs.push(`[PSTAFF] ${me.nickname} used ${mana.amount} WP`, mana.logs);

		logs.addSubLogs(manaLogs);

		/* Remove a buff from an enemy */
		if (attacking) {
			/* Remove buff */
			let buffToRemove, buffFound;
			for (let i in attacking.buffs) {
				if (buffFound) break;
				let buff = attacking.buffs[i];
				if (!buff.debuff) {
					buffFound = true;
					buffToRemove = i;
				}
			}
			let removedBuff = attacking.buffs.splice(buffToRemove, 1);

			/* Calculate damage */
			let damage = WeaponInterface.getDamage(me.stats.mag, this.stats[0] / 100);

			/* Deal damage and freeze*/
			damage = WeaponInterface.inflictDamage(me, attacking, damage, WeaponInterface.MAGICAL, {
				me,
				allies: team,
				enemies: enemy,
			});

			logs.push(
				`[PSTAFF] ${me.nickname} removed ${removedBuff[0].name} from ${attacking.nickname} and damaged for ${damage.amount} HP`,
				damage.logs
			);
		}

		/* Remove a debuff from an ally */
		if (ally) {
			/* Remove debuff */
			let buffToRemove, buffFound;
			for (let i in ally.buffs) {
				if (buffFound) break;
				let buff = ally.buffs[i];
				if (buff.debuff) {
					buffFound = true;
					buffToRemove = i;
				}
			}
			let removedBuff = ally.buffs.splice(buffToRemove, 1);

			/* Calculate heal */
			let heal = WeaponInterface.getDamage(me.stats.att, this.stats[1] / 100);

			/* Heal ally */
			heal = WeaponInterface.heal(ally, heal, me, {
				me,
				allies: team,
				enemies: enemy,
			});

			logs.push(
				`[PSTAFF] ${me.nickname} removed ${removedBuff[0].name} from ${ally.nickname} and healed for ${heal.amount} HP`,
				heal.logs
			);
		}

		return logs;
	}
};
