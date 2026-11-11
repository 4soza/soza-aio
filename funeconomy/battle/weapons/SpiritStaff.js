/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 */

const WeaponInterface = require('../WeaponInterface.js');
const Logs = require('../util/logUtil.js');

module.exports = class SpiritStaff extends WeaponInterface {
	init() {
		this.id = 12;
		this.name = 'Spirit Staff';
		this.basicDesc = '';
		this.emojis = Array(7).fill('👻');
		this.pristineEmojis = Array(7).fill('👻');
		this.defaultEmoji = '👻';
		this.statDesc =
			'Heal all allies for **?%** of your ' +
			WeaponInterface.magEmoji +
			'MAG and applies **Defense Up** for 2 turns';
		this.availablePassives = 'all';
		this.passiveCount = 1;
		this.qualityList = [[30, 50]];
		this.manaRange = [225, 125];
		this.buffList = [4];
	}

	attackWeapon(me, team, enemy) {
		if (me.stats.hp[0] <= 0) return;

		/* No mana */
		if (me.stats.wp[0] < this.manaCost) return this.attackPhysical(me, team, enemy);

		let logs = new Logs();

		/* deplete weapon points*/
		let mana = WeaponInterface.useMana(me, this.manaCost, me, {
			me,
			allies: team,
			enemies: enemy,
		});
		let manaLogs = new Logs();
		manaLogs.push(`[SSTAFF] ${me.nickname} used ${mana.amount} WP`, mana.logs);

		/* Heal all allies */
		let subLogs = new Logs();
		let heal = WeaponInterface.getDamage(me.stats.mag, this.stats[0] / 100);
		for (let i = 0; i < team.length; i++) {
			if (team[i].stats.hp[0] > 0) {
				// Heal
				let hl = WeaponInterface.heal(team[i], heal, me, {
					me,
					allies: team,
					enemies: enemy,
				});
				subLogs.push(hl.logs);
				// Apply buff
				let buff = this.getBuffs(me)[0];
				let buffLogs = buff.attemptBind(team[i], 2, {
					me: team[i],
					allies: team,
					enemies: enemy,
				});
				subLogs.push(buffLogs);
			}
		}

		let logText = `[SSTAFF] ${me.nickname} healed allies for ${heal} HP and applied Defense Up`;

		logs.push(logText, subLogs);
		logs.addSubLogs(manaLogs);

		return logs;
	}
};
