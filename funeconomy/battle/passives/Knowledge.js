/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 */

const PassiveInterface = require('../PassiveInterface.js');

module.exports = class Snail extends PassiveInterface {
	init() {
		this.id = 21;
		this.name = 'Knowledge';
		this.basicDesc = '';
		this.emojis = Array(7).fill('📚');
		this.statDesc =
			'This passive does not do anything in battle. However, it will give this animal **?%** extra xp after each battle.';
		this.qualityList = [[5, 15]];
	}
};
