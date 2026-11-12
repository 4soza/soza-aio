/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 * New weapon/passive designed for this bot (uses OwO's weapon framework).
 */

const WeaponInterface = require('../WeaponInterface.js');
const Logs = require('../util/logUtil.js');

module.exports = class Crossbow extends WeaponInterface {
	init() {
		this.id = 24;
		this.name = 'Crossbow';
		this.basicDesc = 'A deadly crossbow that hunts the weakest enemy';
		this.emojis = Array(7).fill('🎯');
		this.pristineEmojis = Array(7).fill('🎯');
		this.defaultEmoji = '🎯';
		this.statDesc = 'Deals **?%** of your ' + WeaponInterface.strEmoji + 'STR to the enemy with the lowest ' + WeaponInterface.hpEmoji + 'HP';
		this.availablePassives = 'all';
		this.passiveCount = 1;
		this.qualityList = [[100, 150]];
		this.manaRange = [220, 120];
	}

	attackWeapon(me, team, enemy) {
		if (me.stats.hp[0] <= 0) return;

		/* No mana */
		if (me.stats.wp[0] < this.manaCost) return this.attackPhysical(me, team, enemy);

		const attacking = WeaponInterface.getLowestHp(enemy);
		if (!attacking) return this.attackPhysical(me, team, enemy);

		let logs = new Logs();

		/* deplete weapon points*/
		const mana = WeaponInterface.useMana(me, this.manaCost, me, { me, allies: team, enemies: enemy });
		const manaLogs = new Logs();
		manaLogs.push(`[XBOW] ${me.nickname} used ${mana.amount} WP`, mana.logs);

		let damage = WeaponInterface.getDamage(me.stats.att, this.stats[0] / 100);
		damage = WeaponInterface.inflictDamage(me, attacking, damage, WeaponInterface.PHYSICAL, { me, allies: team, enemies: enemy });
		logs.push(`[XBOW] ${me.nickname} shot ${attacking.nickname} for ${damage.amount} HP`, damage.logs);

		logs.addSubLogs(manaLogs);
		return logs;
	}
};
