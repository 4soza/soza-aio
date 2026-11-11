/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 */

const WeaponInterface = require('../WeaponInterface.js');
const Logs = require('../util/logUtil.js');

module.exports = class GlacialAxe extends WeaponInterface {
	init() {
		this.id = 15;
		this.name = 'Glacial Axe';
		this.basicDesc = '';
		this.emojis = Array(7).fill('🪓');
		this.pristineEmojis = Array(7).fill('🪓');
		this.defaultEmoji = '🪓';
		this.statDesc =
			'Deals **?%** of your ' +
			WeaponInterface.strEmoji +
			'STR to a random opponent and apply **Freeze** for 2 turns';
		this.availablePassives = 'all';
		this.passiveCount = 1;
		this.qualityList = [[20, 40]];
		this.manaRange = [280, 180];
		this.buffList = [5];
	}

	attackWeapon(me, team, enemy) {
		if (me.stats.hp[0] <= 0) return;

		/* No mana */
		if (me.stats.wp[0] < this.manaCost) return this.attackPhysical(me, team, enemy);

		/* Grab an enemy that I'm attacking */
		let attacking = WeaponInterface.getAttacking(me, team, enemy, {
			excludeBuff: [this.buffList[0]],
		});
		if (!attacking) return;

		if (attacking.buffs.findIndex((buff) => buff.id === this.buffList[0]) >= 0)
			return this.attackPhysical(me, team, enemy);

		let logs = new Logs();

		/* deplete weapon points*/
		let mana = WeaponInterface.useMana(me, this.manaCost, me, {
			me,
			allies: team,
			enemies: enemy,
		});
		let manaLogs = new Logs();
		manaLogs.push(`[GAXE] ${me.nickname} used ${mana.amount} WP`, mana.logs);

		/* Calculate damage */
		let damage = WeaponInterface.getDamage(me.stats.att, this.stats[0] / 100);

		/* Deal damage and freeze*/
		damage = WeaponInterface.inflictDamage(me, attacking, damage, WeaponInterface.PHYSICAL, {
			me,
			allies: team,
			enemies: enemy,
		});
		let buff = this.getBuffs(me)[0];
		let buffLogs = buff.attemptBind(attacking, 2, {
			me,
			allies: team,
			enemies: enemy,
		});
		logs.push(
			`[GAXE] ${me.nickname} damaged ${attacking.nickname} for ${damage.amount} HP and applied freeze`,
			damage.logs
		);
		logs.addSubLogs(buffLogs);

		logs.addSubLogs(manaLogs);

		return logs;
	}
};
