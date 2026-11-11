/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 *
 * Helper kecil yang dipakai command battle/team/weapon.
 */
const { escapeMarkdown } = require('discord.js');
const cfg = require('../config');
const { send, sendTemporaryError, errorLine, displayName } = require('../utils');
const { ANIMALS } = require('../zoo/data');

const SHARD_EMOJI = '🧩';
const CRATE_EMOJI = '📦';
const TEAM_EMOJI = '🛋';
const WEAPON_EMOJI = '🗡';
const DISMANTLE_EMOJI = '🔨';

/* "🐶 **name**, text" (balasan sukses gaya OwO) */
const reply = (message, emoji, text) => send(message, `${emoji} | **${displayName(message)}**, ${text}`);
const fail = (message, text, ms) => ms
	? sendTemporaryError(message, errorLine(displayName(message), text), ms)
	: send(message, errorLine(displayName(message), text));

/* Nama pendek untuk user (member di guild kalau ada) */
const userName = (guild, user) =>
	escapeMarkdown(guild?.members?.cache?.get(user.id)?.displayName ?? user.globalName ?? user.username ?? 'Someone');

/* Nama hewan yang aman untuk ditampilkan */
const cleanNickname = (text) => String(text).replace(/[\u0000-\u001f`@*_~|>]/g, '').replace(/\s+/g, ' ').trim();

/* hewan dari token (nama/alias/emoji) */
const animalFromToken = (token) => require('../zoo/data').findAnimal(token);

/* Cari user dari mention / ID */
async function resolveUser(message, token, client) {
	const mention = /^<@!?(\d+)>$/.exec(token || '');
	const id = mention ? mention[1] : (/^\d{17,20}$/.test(token || '') ? token : null);
	if (!id) return null;
	return message.mentions?.users?.get(id) || await client.users.fetch(id).catch(() => null);
}

const isUserToken = (token) => /^(<@!?\d+>|\d{17,20})$/.test(token || '');
const isInt = (token) => /^\d+$/.test(token || '');

module.exports = {
	SHARD_EMOJI, CRATE_EMOJI, TEAM_EMOJI, WEAPON_EMOJI, DISMANTLE_EMOJI,
	reply, fail, userName, cleanNickname, animalFromToken, resolveUser, isUserToken, isInt, ANIMALS, cfg
};
