/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 */
const battleUtil = require('./util/battleUtil.js');
const teamUtil = require('./teamUtil.js');
const crateDb = require('./crateDb.js');

const MAX_TURNS = 24;

/* Satu pertandingan: player vs enemy (keduanya objek team dari teamUtil). */
class BattleEvent {
	constructor({ friendly = false, playerName = 'You', enemyName = 'Enemy' } = {}) {
		this.friendly = friendly;
		this.playerName = playerName;
		this.enemyName = enemyName;
		this.logs = [];
		this.endResult = {};
		this.player = undefined;
		this.enemy = undefined;
		this.simulated = false;
	}

	init(player, enemy) {
		this.player = player;
		this.enemy = enemy;
		this.initialized = !!(player && enemy);
		return this.initialized;
	}

	simulateBattle() {
		if (!this.initialized) return;
		// Iteratif (OwO memakai rekursi): berhenti saat salah satu mati atau terlalu panjang.
		while (!this.checkBattleDone()) {
			battleUtil.updatePreviousStats(this);

			const battleLogs = [
				...battleUtil.preTurn(this.player.team, this.enemy.team),
				...battleUtil.preTurn(this.enemy.team, this.player.team),
				...battleUtil.executeTurn(this.player.team, this.enemy.team),
				...battleUtil.postTurn(this.player.team, this.enemy.team),
				...battleUtil.postTurn(this.enemy.team, this.player.team)
			];

			battleUtil.removeBuffs(this.player.team, this.enemy.team);

			const state = battleUtil.saveStates(this);
			if (battleLogs.length > 0) state.battleLogs = battleLogs;
			this.logs.push(state);
		}
		this.simulated = true;
	}

	checkBattleDone() {
		const enemyWin = teamUtil.isDead(this.player.team);
		const playerWin = teamUtil.isDead(this.enemy.team);
		if (enemyWin || playerWin) {
			const logLength = this.logs.length + 1;
			let text = `It's a tie in ${logLength} turns!`;
			let outcome = 'tie';
			if (enemyWin && !playerWin) {
				outcome = 'enemy';
				text = this.friendly ? `${this.enemyName} wins!` : `You lost in ${logLength} turns!`;
			} else if (playerWin && !enemyWin) {
				outcome = 'player';
				text = this.friendly ? `${this.playerName} wins!` : `You won in ${logLength} turns!`;
			}
			this.endResult = { enemyWin, playerWin, outcome, text, color: { tie: 0x616063, enemy: 0xff0000, player: 0x00ff00 }[outcome] };
			return true;
		}
		if (this.logs.length >= MAX_TURNS) {
			this.endResult = { enemyWin: true, playerWin: true, outcome: 'tie', color: 0x616063, text: "Battle was too long! It's a tie!" };
			return true;
		}
		return false;
	}

	getLength() {
		return this.logs.length;
	}

	/*
	 * XP + streak + crate untuk pemain (battle melawan lawan random). Hanya dijalankan sekali per battle.
	 * Return { crate } berisi hasil crate (atau undefined).
	 */
	async distributeRewards({ userId = this.player.userId, random } = {}) {
		if (!this.simulated || !this.initialized || this.friendly) return {};
		const { playerWin, enemyWin } = this.endResult;
		if (!playerWin && !enemyWin) return {};

		this.endResult.pXP = battleUtil.calculateXP(
			{ team: this.player, win: playerWin }, { team: this.enemy, win: enemyWin }, this.player.streak
		);

		// xpOverrides memakai pid unik; ubah ke key hewan untuk database
		const overrides = {};
		for (const animal of this.player.team) overrides[animal.key] = this.endResult.pXP.xpOverrides[animal.pid];
		await teamUtil.giveXpToUserTeams(userId, this.endResult.pXP.total, { xpOverrides: overrides, secondary: true });
		await teamUtil.updateTeamStreak(userId, this.player.index, this.endResult.pXP);
		await battleUtil.updateTT(this.player);

		const crate = await crateDb.crateFromBattle(userId, { random });
		this.endResult.crate = crate;
		return { crate };
	}
}

module.exports = BattleEvent;
module.exports.MAX_TURNS = MAX_TURNS;
