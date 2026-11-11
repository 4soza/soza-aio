/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 */

const WeaponInterface = require('../WeaponInterface.js');

const maxAnimals = 6;
const attack = '👊🏼';
exports.attack = attack;
const weapon = '🗡';
exports.weapon = weapon;

/* Do stuff before the turn starts (usually for buffs) */
exports.preTurn = function (team, enemy) {
	const action = [weapon, weapon, weapon];
	let logs = [];

	for (let i in team) {
		let animal = team[i];
		let check = WeaponInterface.canAttack(animal, team, enemy, action);
		animal.disabled = check;
		for (let j in animal.buffs) {
			let log = animal.buffs[j].preTurn(animal, team, enemy, action[i]);
			if (log) logs = logs.concat(log.logs);
		}
		for (let j in animal.debuffs) {
			let log = animal.debuffs[j].preTurn(animal, team, enemy, action[i]);
			if (log) logs = logs.concat(log.logs);
		}
		if (animal.weapon) {
			let log = animal.weapon.preTurn(animal, team, enemy, action[i]);
			if (log) logs = logs.concat(log.logs);
			for (let j in animal.weapon.passives) {
				let log2 = animal.weapon.passives[j].preTurn(animal, team, enemy, action[i]);
				if (log2) logs = logs.concat(log2.logs);
			}
		}
	}

	return logs;
};

/* Calculates a turn for a team */
exports.executeTurn = function (team, enemy) {
	const action = {
		ally: [weapon, weapon, weapon],
		enemy: [weapon, weapon, weapon],
	};
	let logs = [];
	let teamPos = 0;
	let enemyPos = 0;
	for (let i = 0; i < maxAnimals; i++) {
		let animal;
		let tempEnemy;
		let tempAlly;
		let tempAction;

		if (teamPos <= enemyPos) {
			animal = team[teamPos];
			tempEnemy = enemy;
			tempAlly = team;
			tempAction = action.ally[teamPos];
			teamPos++;
		} else {
			animal = enemy[enemyPos];
			tempEnemy = team;
			tempAlly = enemy;
			tempAction = action.enemy[enemyPos];
			enemyPos++;
		}

		let log;

		if (animal) {
			// Animal is not allowed to attack
			if (animal.disabled && !animal.disabled.canAttack) {
				if (animal.disabled.logs && animal.disabled.logs.logs.length > 0)
					logs = logs.concat(animal.disabled.logs.logs);

				// Animal has a weapon
			} else if (animal.weapon) {
				if (tempAction == weapon) log = animal.weapon.attackWeapon(animal, tempAlly, tempEnemy);
				else log = animal.weapon.attackPhysical(animal, tempAlly, tempEnemy);

				// Animal has no weapon
			} else {
				log = WeaponInterface.basicAttack(animal, tempAlly, tempEnemy);
			}
		}

		// Combine all the logs
		if (log) logs = logs.concat(log.logs);
	}

	return logs;
};

/* Do stuff after the turn ends (usually for buffs) */
exports.postTurn = function (team, enemy) {
	const action = [weapon, weapon, weapon];
	let logs = [];
	for (let i in team) {
		let animal = team[i];
		let j = animal.buffs.length;
		while (j--) {
			let log = animal.buffs[j].postTurn(animal, team, enemy, action[i]);
			if (log) logs = logs.concat(log.logs);
		}
		j = animal.debuffs.length;
		while (j--) {
			let log = animal.debuffs[j].postTurn(animal, team, enemy, action[i]);
			if (log) logs = logs.concat(log.logs);
		}
		if (animal.weapon) {
			let log = animal.weapon.postTurn(animal, team, enemy, action[i]);
			if (log) logs = logs.concat(log.logs);
			for (let j in animal.weapon.passives) {
				let log2 = animal.weapon.passives[j].postTurn(animal, team, enemy, action[i]);
				if (log2) logs = logs.concat(log2.logs);
			}
		}
	}

	return logs;
};

/* strip buffs after turn fully processed */
exports.removeBuffs = function (team, enemy) {
	for (let i in team) {
		let animal = team[i];
		let j = animal.buffs.length;
		while (j--) {
			if (animal.buffs[j].markedForDeath) {
				animal.buffs.splice(j, 1);
			}
		}
		j = animal.debuffs.length;
		while (j--) {
			if (animal.debuffs[j].markedForDeath) {
				animal.debuffs.splice(j, 1);
			}
		}
	}
	for (let i in enemy) {
		let animal = enemy[i];
		let j = animal.buffs.length;
		while (j--) {
			if (animal.buffs[j].markedForDeath) {
				animal.buffs.splice(j, 1);
			}
		}
		j = animal.debuffs.length;
		while (j--) {
			if (animal.debuffs[j].markedForDeath) {
				animal.debuffs.splice(j, 1);
			}
		}
	}
};

/* Calculate xp depending on win/loss/tie */
exports.calculateXP = function (team, enemy, currentStreak = 0) {
	/* Find the avg level diff for xp multipliers */
	let playeravg = 0;
	for (let i in team.team.team) playeravg += team.team.team[i].stats.lvl;
	playeravg /= team.team.team.length;

	let enemyavg = 0;
	for (let i in enemy.team.team) enemyavg += enemy.team.team[i].stats.lvl;
	enemyavg /= enemy.team.team.length;

	let lvlDiff = enemyavg - playeravg;
	if (lvlDiff < 0) lvlDiff = 0;

	/* Calculate xp and streak */
	/* lose */
	let xp = 50;
	let resetStreak = true;
	let addStreak = false;
	let bonus = 0;
	/* tie */
	if (team.win && enemy.win) {
		resetStreak = false;
		addStreak = false;
		xp = 100;
		/* win */
	} else if (team.win) {
		resetStreak = false;
		addStreak = true;
		xp = 200;
		bonus = Math.round(600 * lvlDiff);
		/* Calculate bonus */
		currentStreak++;
		bonus += bonusXP(currentStreak);
	}

	const total = xp + bonus;

	let highestLvl = 1;
	let xpOverrides = {};
	for (let i in team.team.team) {
		let lvl = team.team.team[i].stats.lvl;
		if (lvl > highestLvl) highestLvl = lvl;
	}

	for (let i in team.team.team) {
		let mult = 1;
		let lvl = team.team.team[i].stats.lvl;
		if (lvl < highestLvl) mult = 2 + (highestLvl - lvl) / 10;
		if (mult > 10) mult = 10;
		mult += team.team.team[i].weapon?.getBonusXPPassive() || 0;
		xpOverrides[team.team.team[i].pid] = Math.round(total * mult);
	}

	return {
		total,
		bonus,
		xp,
		resetStreak,
		addStreak,
		xpOverrides,
	};
};

/* Bonus xp depending on the streak */
function bonusXP(streak) {
	let bonus = 0;
	if (streak % 1000 === 0) bonus = 25 * (Math.sqrt(streak / 100) * 100 + 500);
	else if (streak % 500 === 0) bonus = 10 * (Math.sqrt(streak / 100) * 100 + 500);
	else if (streak % 100 === 0) bonus = 5 * (Math.sqrt(streak / 100) * 100 + 500);
	else if (streak % 50 === 0) bonus = 3 * (Math.sqrt(streak / 100) * 100 + 500);
	else if (streak % 10 === 0) bonus = Math.sqrt(streak / 100) * 100 + 500;
	else bonus = 0;
	bonus = Math.round(bonus);
	if (bonus > 100000) bonus = 100000;
	return bonus;
}

/* Test bonus xp */
/*
let totalxp = 0;
let pxp = 0;
for(let i = 35000;i<=40000;i+=10){
	pxp += 10*200;
	let currentxp = bonusXP(i);
	totalxp += currentxp;
	console.log(`[${i}] ${currentxp} | ${totalxp} | ${pxp}`);
}
*/

/* Saves both team's status */
exports.saveStates = function (battle) {
	let player = [];
	for (let i in battle.player.team) {
		let info = parseAnimalInfo(battle.player.team[i]);
		let result = {
			info,
			hp: battle.player.team[i].stats.hp.slice(),
			wp: battle.player.team[i].stats.wp.slice(),
			buffs: [],
		};
		for (let j in battle.player.team[i].buffs) {
			result.buffs.push({ emoji: battle.player.team[i].buffs[j].emoji });
		}
		player.push(result);
	}
	let enemy = [];
	for (let i in battle.enemy.team) {
		let info = parseAnimalInfo(battle.enemy.team[i]);
		let result = {
			info,
			hp: battle.enemy.team[i].stats.hp.slice(),
			wp: battle.enemy.team[i].stats.wp.slice(),
			buffs: [],
		};
		for (let j in battle.enemy.team[i].buffs) {
			result.buffs.push({ emoji: battle.enemy.team[i].buffs[j].emoji });
		}
		enemy.push(result);
	}
	return { player, enemy };
};

/* parses animal info for logs */
function parseAnimalInfo(animal) {
	let info = animal;
	return info;
}

/* Updates the previous hp/wp */
exports.updatePreviousStats = function (battle) {
	for (let i in battle.player.team) {
		battle.player.team[i].stats.hp[2] = battle.player.team[i].stats.hp[0];
		battle.player.team[i].stats.wp[2] = battle.player.team[i].stats.wp[0];
	}
	for (let i in battle.enemy.team) {
		battle.enemy.team[i].stats.hp[2] = battle.enemy.team[i].stats.hp[0];
		battle.enemy.team[i].stats.wp[2] = battle.enemy.team[i].stats.wp[0];
	}
};

exports.bonusXP = bonusXP;

/* Saves tracker kills of every weapon in a team (real weapons only) */
exports.updateTT = function (battleTeam) {
	const promises = [];
	for (let key in battleTeam.team) {
		const animal = battleTeam.team[key];
		if (animal?.weapon?.hasTakedownTracker && animal.weapon.ruwid && animal.weapon.battleKills) {
			promises.push(require('./weaponDb.js').addKills(animal.weapon.ruwid, animal.weapon.battleKills));
		}
	}
	return Promise.all(promises);
};
