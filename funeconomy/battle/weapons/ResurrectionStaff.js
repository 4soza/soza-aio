/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 */

const WeaponInterface = require('../WeaponInterface.js');
const Logs = require('../util/logUtil.js');

module.exports = class ResurrectionStaff extends WeaponInterface {
	init() {
		this.id = 14;
		this.name = 'Resurrection Staff';
		this.basicDesc = '';
		this.emojis = Array(7).fill('⚰️');
		this.pristineEmojis = Array(7).fill('⚰️');
		this.defaultEmoji = '⚰️';
		this.statDesc =
			'Revive a dead ally and heal them for **?%** of your ' + WeaponInterface.magEmoji + 'MAG';
		this.availablePassives = 'all';
		this.passiveCount = 1;
		this.qualityList = [[50, 80]];
		this.manaRange = [400, 300];
	}

	attackWeapon(me, team, enemy) {
		if (me.stats.hp[0] <= 0) return;

		/* No mana */
		if (me.stats.wp[0] < this.manaCost) return this.attackPhysical(me, team, enemy);

		let logs = new Logs();

		/* Grab lowest wp */
		let dead = WeaponInterface.getDead(team);
		if (!dead) return this.attackPhysical(me, team, enemy);

		/* Calculate heal */
		let heal = WeaponInterface.getDamage(me.stats.mag, this.stats[0] / 100);

		/* deplete weapon points*/
		let mana = WeaponInterface.useMana(me, this.manaCost, me, {
			me,
			allies: team,
			enemies: enemy,
		});
		let manaLogs = new Logs();
		manaLogs.push(`[RSTAFF] ${me.nickname} used ${mana.amount} WP`, mana.logs);

		/* revive ally */
		dead.stats.hp[0] = 0;
		heal = WeaponInterface.heal(dead, heal, me, {
			me,
			allies: team,
			enemies: enemy,
		});
		logs.push(`[RSTAFF] ${me.nickname} revived ${dead.nickname} with ${heal.amount} HP`, heal.logs);

		logs.addSubLogs(manaLogs);

		return logs;
	}
};
