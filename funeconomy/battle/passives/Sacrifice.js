/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 */

const PassiveInterface = require('../PassiveInterface.js');
const WeaponInterface = require('../WeaponInterface.js');
const Log = require('../util/logUtil.js');

module.exports = class Sacrifice extends PassiveInterface {
	init() {
		this.id = 19;
		this.name = 'Sacrifice';
		this.basicDesc = '';
		this.emojis = Array(7).fill('🕯️');
		this.statDesc = `When this animal dies, heal your teammates for **?%** of its Max ${WeaponInterface.hpEmoji}HP and replenish for **?%** of its Max ${WeaponInterface.wpEmoji}WP`;

		this.qualityList = [
			[50, 75],
			[50, 75],
		];
	}

	postAttacked(animal, attacker, totalDamage, type, tags) {
		if (tags.has('sacrifice', animal)) return;
		// Only active when dead
		if (animal.stats.hp[0] > 0) return;

		let logs = new Log();

		let alive = WeaponInterface.getAlive(tags.getAnimalAllies(animal));

		let healAmount = WeaponInterface.getDamageFromHpWp(animal.stats.hp, this.stats[0] / 100);
		let wpAmount = WeaponInterface.getDamageFromHpWp(animal.stats.wp, this.stats[1] / 100);
		const tagsCopy1 = tags.copyAdd('sacrifice', animal, {
			me: animal,
			allies: tags.allies,
			enemies: tags.enemies,
		});
		const tagsCopy2 = tags.copyAdd('sacrifice', animal, {
			me: animal,
			allies: tags.allies,
			enemies: tags.enemies,
		});

		let healLogText = `[SAC] ${animal.nickname} healed `;
		let healSubLogs = new Log();
		let repLogText = `[SAC] ${animal.nickname} replenished `;
		let repSubLogs = new Log();
		for (let i in alive) {
			let team = alive[i];
			if (team.pid !== animal.pid) {
				let heal = WeaponInterface.heal(team, healAmount, animal, tagsCopy1);
				healLogText += `${team.nickname} ${heal.amount} | `;
				healSubLogs.push(heal.logs);

				let wp = WeaponInterface.replenish(team, wpAmount, animal, tagsCopy2);
				repLogText += `${team.nickname} ${wp.amount} | `;
				repSubLogs.push(wp.logs);
			}
		}

		healLogText = healLogText.slice(0, -2) + 'HP';
		logs.push(healLogText, healSubLogs);

		repLogText = repLogText.slice(0, -2) + 'WP';
		logs.push(repLogText, repSubLogs);

		return logs;
	}
};
