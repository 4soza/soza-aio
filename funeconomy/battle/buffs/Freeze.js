/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 */

const BuffInterface = require('../BuffInterface.js');
const Logs = require('../util/logUtil.js');

module.exports = class Freeze extends BuffInterface {
	init() {
		this.id = 5;
		this.name = 'Freeze';
		this.debuff = true;
		this.emoji = '❄️';
		this.statDesc = 'Freeze an enemy. They can not attack next turn.';
		this.qualityList = [];
	}

	canAttack(me, ally, enemy, action, result) {
		// Freeze only works next turn
		if (this.justCreated) return;

		result.result = false;
		super.postTurn(me, ally, enemy, action);

		let logs = new Logs();
		logs.push(`[FREEZE] ${me.nickname} is frozen and can't attack`);
		return logs;
	}

	// Skip duration decrementation, because we will do that in canAttack
	postTurn(_animal, _ally, _enemy, _action) {
		if (this.justCreated) this.justCreated = false;
	}
};
