/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 */

const WeaponInterface = require('../WeaponInterface.js');
const Logs = require('../util/logUtil.js');

module.exports = class VampStaff extends WeaponInterface {
	init() {
		this.id = 7;
		this.name = 'Vampiric Staff';
		this.basicDesc = '';
		this.emojis = Array(7).fill('🧛');
		this.pristineEmojis = Array(7).fill('🧛');
		this.defaultEmoji = '🧛';
		this.statDesc =
			'Deal **?%** of your ' +
			WeaponInterface.magEmoji +
			'MAG to ALL enemies and heal ALL allies by the damage dealt';
		this.availablePassives = 'all';
		this.passiveCount = 1;
		this.qualityList = [[25, 45]];
		this.manaRange = [200, 100];
	}

	attackWeapon(me, team, enemy) {
		if (me.stats.hp[0] <= 0) return;

		/* No mana */
		if (me.stats.wp[0] < this.manaCost) return this.attackPhysical(me, team, enemy);

		let logs = new Logs();

		/* Calculate damage */
		let damage = WeaponInterface.getDamage(me.stats.mag, this.stats[0] / 100);

		/* deplete weapon points*/
		let mana = WeaponInterface.useMana(me, this.manaCost, me, {
			me,
			allies: team,
			enemies: enemy,
		});
		let manaLogs = new Logs();
		manaLogs.push(`[VSTAFF] ${me.nickname} used ${mana.amount} WP`, mana.logs);

		/* Deal damage to all opponents*/
		let dealt = 0;
		let logText = `[VSTAFF] ${me.nickname} damaged `;
		let subLogs = new Logs();
		for (let i = 0; i < enemy.length; i++) {
			if (enemy[i].stats.hp[0] > 0) {
				let dmg = WeaponInterface.inflictDamage(me, enemy[i], damage, WeaponInterface.MAGICAL, {
					me,
					allies: team,
					enemies: enemy,
				});
				dealt += dmg.amount;
				logText += `${enemy[i].nickname} -${dmg.amount} | `;
				subLogs.push(dmg.logs);
			}
		}
		logText = logText.slice(0, -2) + 'HP';
		logs.push(logText, subLogs);

		/* Heal all allies */
		let alive = WeaponInterface.getAlive(team);
		alive = alive.length > 1 ? alive.length : 1;
		let heal = dealt / alive;
		logText = `[VSTAFF] ${me.nickname} healed `;
		subLogs = new Logs();
		for (let i = 0; i < team.length; i++) {
			if (team[i].stats.hp[0] > 0) {
				let hl = WeaponInterface.heal(team[i], heal, me, {
					me,
					allies: team,
					enemies: enemy,
				});
				logText += `${team[i].nickname} ${hl.amount} | `;
				subLogs.push(hl.logs);
			}
		}
		logText = logText.slice(0, -2) + 'HP';
		let healLogs = new Logs();
		healLogs.push(logText, subLogs);
		logs.addSubLogs(healLogs);

		logs.addSubLogs(manaLogs);

		return logs;
	}
};
