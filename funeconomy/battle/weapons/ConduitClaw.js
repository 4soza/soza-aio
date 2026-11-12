/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 * New weapon/passive designed for this bot (uses OwO's weapon framework).
 */

const WeaponInterface = require('../WeaponInterface.js');
const Logs = require('../util/logUtil.js');

module.exports = class ConduitClaw extends WeaponInterface {
	init() {
		this.id = 23;
		this.name = 'Conduit Claw';
		this.basicDesc = 'A claw that turns blows into energy';
		this.emojis = Array(7).fill('🦞');
		this.pristineEmojis = Array(7).fill('🦞');
		this.defaultEmoji = '🦞';
		this.statDesc = 'Deals **?%** of your ' + WeaponInterface.strEmoji + 'STR to a random enemy and replenishes **?%** of the damage dealt as ' + WeaponInterface.wpEmoji + 'WP to the ally with the lowest WP';
		this.availablePassives = 'all';
		this.passiveCount = 1;
		this.qualityList = [[60, 90], [30, 60]];
		this.manaRange = [200, 100];
	}

	attackWeapon(me, team, enemy) {
		if (me.stats.hp[0] <= 0) return;

		/* No mana */
		if (me.stats.wp[0] < this.manaCost) return this.attackPhysical(me, team, enemy);

		let attacking = WeaponInterface.getAttacking(me, team, enemy);
		if (!attacking) return;

		let logs = new Logs();

		/* deplete weapon points*/
		const mana = WeaponInterface.useMana(me, this.manaCost, me, { me, allies: team, enemies: enemy });
		const manaLogs = new Logs();
		manaLogs.push(`[CCLAW] ${me.nickname} used ${mana.amount} WP`, mana.logs);

		let damage = WeaponInterface.getDamage(me.stats.att, this.stats[0] / 100);
		damage = WeaponInterface.inflictDamage(me, attacking, damage, WeaponInterface.PHYSICAL, { me, allies: team, enemies: enemy });
		logs.push(`[CCLAW] ${me.nickname} damaged ${attacking.nickname} for ${damage.amount} HP`, damage.logs);

		/* Replenish the ally with the lowest WP */
		let lowest;
		for (const ally of team) {
			if (ally.stats.hp[0] <= 0) continue;
			if (!lowest || ally.stats.wp[0] < lowest.stats.wp[0]) lowest = ally;
		}
		if (lowest) {
			const amount = (damage.amount * this.stats[1]) / 100;
			const replenish = WeaponInterface.replenish(lowest, amount, me, { me, allies: team, enemies: enemy });
			logs.push(`[CCLAW] ${me.nickname} replenished ${lowest.nickname} for ${replenish.amount} WP`, replenish.logs);
		}

		logs.addSubLogs(manaLogs);
		return logs;
	}
};
