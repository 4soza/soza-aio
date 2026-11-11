/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 */

const WeaponInterface = require('../WeaponInterface.js');
const Logs = require('../util/logUtil.js');

module.exports = class FoulFish extends WeaponInterface {
	init() {
		this.id = 21;
		this.name = 'Foul Fish';
		this.basicDesc = '';
		this.emojis = Array(7).fill('🐟');
		this.pristineEmojis = Array(7).fill('🐟');
		this.defaultEmoji = '🐟';
		this.statDesc = `Deal **?%** of your ${WeaponInterface.strEmoji}STR to a random enemy and apply **Stinky** for 2 turns.`;
		this.availablePassives = 'all';
		this.passiveCount = 1;
		this.qualityList = [[50, 80]];
		this.manaRange = [280, 180];
		this.buffList = [12];
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
		manaLogs.push(`[FFISH] ${me.nickname} used ${mana.amount} WP`, mana.logs);

		/* Calculate damage */
		let damage = WeaponInterface.getDamage(me.stats.att, this.stats[0] / 100);

		/* Deal damage */
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
			`[FFISH] ${me.nickname} damaged ${attacking.nickname} for ${damage.amount} HP and applied Stinky`,
			damage.logs
		);
		logs.addSubLogs(buffLogs);

		logs.addSubLogs(manaLogs);

		return logs;
	}
};
