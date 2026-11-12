/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 * New weapon/passive designed for this bot (uses OwO's weapon framework).
 */

const WeaponInterface = require('../WeaponInterface.js');
const Logs = require('../util/logUtil.js');

module.exports = class FrostStaff extends WeaponInterface {
	init() {
		this.id = 27;
		this.name = 'Frost Staff';
		this.basicDesc = 'A crystal staff that freezes enemies';
		this.emojis = Array(7).fill('🧊');
		this.pristineEmojis = Array(7).fill('🧊');
		this.defaultEmoji = '🧊';
		this.statDesc = 'Deals **?%** of your ' + WeaponInterface.magEmoji + 'MAG to a random enemy and applies **Freeze** for 2 turns';
		this.availablePassives = 'all';
		this.passiveCount = 1;
		this.qualityList = [[30, 50]];
		this.manaRange = [280, 180];
		this.buffList = [5];
	}

	attackWeapon(me, team, enemy) {
		if (me.stats.hp[0] <= 0) return;

		/* No mana */
		if (me.stats.wp[0] < this.manaCost) return this.attackPhysical(me, team, enemy);

		const attacking = WeaponInterface.getAttacking(me, team, enemy, { excludeBuff: [this.buffList[0]] });
		if (!attacking) return;
		if (attacking.buffs.findIndex((buff) => buff.id === this.buffList[0]) >= 0)
			return this.attackPhysical(me, team, enemy);

		let logs = new Logs();

		/* deplete weapon points*/
		const mana = WeaponInterface.useMana(me, this.manaCost, me, { me, allies: team, enemies: enemy });
		const manaLogs = new Logs();
		manaLogs.push(`[FROST] ${me.nickname} used ${mana.amount} WP`, mana.logs);

		let damage = WeaponInterface.getDamage(me.stats.mag, this.stats[0] / 100);
		damage = WeaponInterface.inflictDamage(me, attacking, damage, WeaponInterface.MAGICAL, { me, allies: team, enemies: enemy });
		const buff = this.getBuffs(me)[0];
		const buffLogs = buff.attemptBind(attacking, 2, { me, allies: team, enemies: enemy });
		logs.push(`[FROST] ${me.nickname} damaged ${attacking.nickname} for ${damage.amount} HP and applied freeze`, damage.logs);
		logs.addSubLogs(buffLogs);

		logs.addSubLogs(manaLogs);
		return logs;
	}
};
