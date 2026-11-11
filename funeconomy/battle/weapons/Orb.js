/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 */

const WeaponInterface = require('../WeaponInterface.js');

module.exports = class Orb extends WeaponInterface {
	init() {
		this.id = 6;
		this.name = 'Orb of Potency';
		this.basicDesc = '';
		this.emojis = Array(7).fill('🔮');
		this.pristineEmojis = Array(7).fill('🔮');
		this.defaultEmoji = '🔮';
		this.statDesc = 'This weapon has no active ability, but comes with two passives!';
		this.availablePassives = 'all';
		this.passiveCount = 2;
		this.qualityList = [];
	}
};
