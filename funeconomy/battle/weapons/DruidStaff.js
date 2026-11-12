/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 * New weapon/passive designed for this bot (uses OwO's weapon framework).
 */

const WeaponInterface = require('../WeaponInterface.js');
const Logs = require('../util/logUtil.js');

module.exports = class DruidStaff extends WeaponInterface {
	init() {
		this.id = 25;
		this.name = 'Druid Staff';
		this.basicDesc = 'A staff that heals the whole team';
		this.emojis = Array(7).fill('🌳');
		this.pristineEmojis = Array(7).fill('🌳');
		this.defaultEmoji = '🌳';
		this.statDesc = 'Heals **?%** of your ' + WeaponInterface.magEmoji + 'MAG to every living ally';
		this.availablePassives = 'all';
		this.passiveCount = 1;
		this.qualityList = [[50, 80]];
		this.manaRange = [260, 170];
	}

	attackWeapon(me, team, enemy) {
		if (me.stats.hp[0] <= 0) return;

		/* No mana */
		if (me.stats.wp[0] < this.manaCost) return this.attackPhysical(me, team, enemy);

		const allies = team.filter((ally) => ally.stats.hp[0] > 0 && !WeaponInterface.isMaxHp(ally));
		if (!allies.length) return this.attackPhysical(me, team, enemy);

		let logs = new Logs();

		/* deplete weapon points*/
		const mana = WeaponInterface.useMana(me, this.manaCost, me, { me, allies: team, enemies: enemy });
		const manaLogs = new Logs();
		manaLogs.push(`[DSTAFF] ${me.nickname} used ${mana.amount} WP`, mana.logs);

		for (const ally of allies) {
			const amount = WeaponInterface.getDamage(me.stats.mag, this.stats[0] / 100);
			const heal = WeaponInterface.heal(ally, amount, me, { me, allies: team, enemies: enemy });
			logs.push(`[DSTAFF] ${me.nickname} healed ${ally.nickname} for ${heal.amount} HP`, heal.logs);
		}

		logs.addSubLogs(manaLogs);
		return logs;
	}
};
