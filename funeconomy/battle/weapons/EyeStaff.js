/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 * New weapon/passive designed for this bot (uses OwO's weapon framework).
 */

const WeaponInterface = require('../WeaponInterface.js');
const Logs = require('../util/logUtil.js');

module.exports = class EyeStaff extends WeaponInterface {
	init() {
		this.id = 26;
		this.name = 'Staff of Sight';
		this.basicDesc = 'A staff whose eye sees every enemy';
		this.emojis = Array(7).fill('👁️');
		this.pristineEmojis = Array(7).fill('👁️');
		this.defaultEmoji = '👁️';
		this.statDesc = 'Deals **?%** of your ' + WeaponInterface.magEmoji + 'MAG to every living enemy';
		this.availablePassives = 'all';
		this.passiveCount = 1;
		this.qualityList = [[35, 55]];
		this.manaRange = [300, 200];
	}

	attackWeapon(me, team, enemy) {
		if (me.stats.hp[0] <= 0) return;

		/* No mana */
		if (me.stats.wp[0] < this.manaCost) return this.attackPhysical(me, team, enemy);

		const targets = enemy.filter((e) => e.stats.hp[0] > 0);
		if (!targets.length) return;

		let logs = new Logs();

		/* deplete weapon points*/
		const mana = WeaponInterface.useMana(me, this.manaCost, me, { me, allies: team, enemies: enemy });
		const manaLogs = new Logs();
		manaLogs.push(`[EYE] ${me.nickname} used ${mana.amount} WP`, mana.logs);

		for (const target of targets) {
			const amount = WeaponInterface.getDamage(me.stats.mag, this.stats[0] / 100);
			const damage = WeaponInterface.inflictDamage(me, target, amount, WeaponInterface.MAGICAL, { me, allies: team, enemies: enemy });
			logs.push(`[EYE] ${me.nickname} damaged ${target.nickname} for ${damage.amount} HP`, damage.logs);
		}

		logs.addSubLogs(manaLogs);
		return logs;
	}
};
