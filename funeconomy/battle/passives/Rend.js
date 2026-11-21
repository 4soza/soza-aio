/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 * New weapon/passive designed for this bot (uses OwO's weapon framework).
 */

// Double Strike: nama kelas tetap "Rend" supaya nama emoji (p_rend_*) dan id passive (22) tidak berubah.
// Serangannya sendiri dijalankan di util/battleUtil.js (doubleStrike) setelah serangan senjata.
const PassiveInterface = require('../PassiveInterface.js');

module.exports = class Rend extends PassiveInterface {
	init() {
		this.id = 22;
		this.name = 'Double Strike';
		this.aliases = ['dstrike', 'double', 'strike'];
		this.basicDesc = 'Chance to attack twice';
		this.emojis = Array(7).fill('🐾');
		this.statDesc =
			'When this animal attacks, it has a **?%** chance to attack one more time with **?%** of the weapon\'s *Effectiveness* and **?%** of the weapon\'s cost.';
		// [peluang, efektivitas, biaya WP] (nilai min/maks ditebak, bukan dari OwO)
		this.qualityList = [[10, 30], [20, 40], [50, 20]];
	}
};
