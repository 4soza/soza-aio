/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 */

const WeaponInterface = require('../WeaponInterface.js');
const Logs = require('../util/logUtil.js');

module.exports = class LeechingScythe extends WeaponInterface {
	init() {
		this.id = 20;
		this.name = 'Leeching Scythe';
		this.basicDesc = '';
		this.emojis = Array(7).fill('🩸');
		this.pristineEmojis = Array(7).fill('🩸');
		this.defaultEmoji = '🩸';
		this.statDesc = `Deal **?%** of your ${WeaponInterface.strEmoji}STR to a random enemy and apply **Leech** for 3 turns. If the **Leech** debuff is already on the target, deal **+?%** more damage.`;
		this.availablePassives = 'all';
		this.passiveCount = 1;
		this.qualityList = [
			[50, 80],
			[40, 60],
		];
		this.manaRange = [230, 130];
		this.buffList = [11];
	}

	attackWeapon(me, team, enemy) {
		if (me.stats.hp[0] <= 0) return;
		/* No mana */
		if (me.stats.wp[0] < this.manaCost) return this.attackPhysical(me, team, enemy);

		let logs = new Logs();

		/* Grab an enemy that I'm attacking */
		let attacking = WeaponInterface.getAttacking(me, team, enemy);
		if (!attacking) return;

		/* deplete weapon points*/
		let mana = WeaponInterface.useMana(me, this.manaCost, me, {
			me,
			allies: team,
			enemies: enemy,
		});
		let manaLogs = new Logs();
		manaLogs.push(`[LSYTH] ${me.nickname} used ${mana.amount} WP`, mana.logs);

		let damagePercent = this.stats[0];
		let appliedLeech = false;
		let buffLogs;
		if (attacking.buffs.findIndex((buff) => buff.id === this.buffList[0]) < 0) {
			appliedLeech = true;
			let buff = this.getBuffs(me)[0];
			buffLogs = buff.attemptBind(attacking, 3, {
				me,
				allies: team,
				enemies: enemy,
			});
		} else {
			damagePercent += this.stats[1];
		}

		/* Calculate damage */
		let damage = WeaponInterface.getDamage(me.stats.att, damagePercent / 100);

		/* Deal damage */
		damage = WeaponInterface.inflictDamage(me, attacking, damage, WeaponInterface.PHYSICAL, {
			me,
			allies: team,
			enemies: enemy,
		});

		logs.push(
			`[LSYTH] ${me.nickname} damaged ${attacking.nickname} for ${damage.amount} HP${
				appliedLeech ? ' and applied Leech' : ''
			}`,
			damage.logs
		);
		logs.addSubLogs(buffLogs);

		logs.addSubLogs(manaLogs);

		return logs;
	}
};
