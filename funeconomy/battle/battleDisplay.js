/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 *
 * Tampilan battle sebagai embed teks (OwO menggambar gambar dengan canvas; di sini diganti bar HP/WP).
 */
const animalUtil = require('./animalUtil.js');
const WeaponInterface = require('./WeaponInterface.js');
const battleUtil = require('./util/battleUtil.js');
const { sleep } = require('../utils');
const { renderBattleImage } = require('./battleImage.js');

const EMBED_COLOR = 0x7ab8f5; // biru yang sama dengan HighLow

function updateTeamStats(team, stats) {
	const percent = Number.isFinite(stats) ? stats / 100 : undefined;
	for (let i = 0; i < team.length; i++) {
		if (percent) {
			team[i].stats.hp[0] = (team[i].stats.hp[1] + team[i].stats.hp[3]) * percent;
			team[i].stats.wp[0] = (team[i].stats.wp[1] + team[i].stats.wp[3]) * percent;
			team[i].buffs = [];
		} else {
			team[i].stats.hp = stats[i].hp;
			team[i].stats.wp = stats[i].wp;
			team[i].buffs = stats[i].buffs;
		}
	}
}

const weaponText = (weapon) => `${weapon.rank.emoji}${weapon.emoji}${weapon.passives.map((p) => p.emoji).join('')}`;
const buffText = (animal) => (animal.buffs.length ? ` ${animal.buffs.map((b) => b.emoji).join('')}` : '');
const nonNeg = (n) => Math.max(0, Math.ceil(n));

/* Satu hewan, mode lengkap (bar HP/WP) */
function animalDisplayText(animal) {
	const s = animal.stats;
	const bar = animalUtil.bar(s).split('\n').map((l) => `\`${l}\``).join('\n');
	let text = `Lvl.${s.lvl} ${animal.animal.value} ${animal.nickname}${buffText(animal)}\n${bar}\n`;
	text += `\`${nonNeg(s.hp[0])} HP\` ${WeaponInterface.strEmoji} \`${Math.ceil(s.att[0] + s.att[1])}\` ${WeaponInterface.prEmoji} \`${WeaponInterface.resToPrettyPercent(s.pr)}\`\n`;
	text += `\`${nonNeg(s.wp[0])} WP\` ${WeaponInterface.magEmoji} \`${Math.ceil(s.mag[0] + s.mag[1])}\` ${WeaponInterface.mrEmoji} \`${WeaponInterface.resToPrettyPercent(s.mr)}\``;
	if (animal.weapon) text += `\n${weaponText(animal.weapon)} ${animal.weapon.avgQuality}%`;
	return text;
}

/* Satu hewan, mode compact */
function animalCompactText(animal) {
	const s = animal.stats;
	let text = `L.${s.lvl} ${animal.animal.value} ${animal.nickname}${buffText(animal)}\n`;
	text += `\`${nonNeg(s.hp[0])} HP\` \`${nonNeg(s.wp[0])} WP\``;
	if (animal.weapon) text += ` ${weaponText(animal.weapon)}`;
	return text;
}

/* Log satu turn dalam code block (dipotong agar muat di embed) */
function parseLogs(turnLogs, limit = 3500) {
	let text = '```ini\n';
	let over = false;
	for (const line of turnLogs || []) {
		if (text.length + line.length < limit) text += `${line}\n`;
		else if (!over) { text += '\n; Log is too long...'; over = true; }
	}
	return `${text}\`\`\``;
}

function teamField(name, animals, display) {
	const render = display === 'compact' ? animalCompactText : animalDisplayText;
	const rows = animals.map(render);
	let value = rows.join('\n');
	if (value.length > 1024) value = rows.map(animalCompactText).join('\n').slice(0, 1024);
	return { name: String(name).slice(0, 256), value: value || '-', inline: true };
}

/*
 * Embed untuk turn ke-`turn` (0 = awal, getLength() = hasil akhir).
 * Mengubah state hewan di event agar sesuai turn tersebut.
 */
function renderTurn(event, turn, { display = 'image', showLogs = false, title } = {}) {
	const length = event.getLength();
	if (turn === 0) {
		updateTeamStats(event.player.team, 100);
		updateTeamStats(event.enemy.team, 100);
	} else {
		const current = event.logs[turn - 1];
		updateTeamStats(event.player.team, current.player);
		updateTeamStats(event.enemy.team, current.enemy);
	}

	const embed = {
		color: EMBED_COLOR,
		author: { name: title || `${event.playerName} goes into battle!` },
		fields: [
			teamField(event.player.name || `${event.playerName}'s team`, event.player.team, display),
			teamField(event.enemy.name || `${event.enemyName}'s team`, event.enemy.team, display)
		]
	};

	if (showLogs && turn > 0 && event.logs[turn - 1].battleLogs) {
		embed.description = parseLogs(event.logs[turn - 1].battleLogs);
	}

	if (turn === length) {
		embed.color = event.endResult.color;
		embed.footer = { text: finalText(event) };
	} else {
		embed.footer = { text: `Turn ${turn + 1}/${length + 1}` };
	}
	return embed;
}

/* Teks hasil akhir (footer) termasuk XP dan streak (OwO getLastDisplay) */
function finalText(event) {
	const { endResult, player } = event;
	let text = endResult.text;
	const pXP = endResult.pXP;
	if (!event.friendly && pXP) {
		text += ` Your team gained ${pXP.xp} xp`;
		if (pXP.resetStreak) text += `! You lost your streak of ${player.streak} wins...`;
		else if (pXP.addStreak) text += pXP.bonus ? ` + ${pXP.bonus} bonus xp! Streak: ${player.streak + 1}` : `! Streak: ${player.streak + 1}`;
		else text += `! Streak: ${player.streak}`;
	}
	return text;
}

/*
 * Tampilkan battle sesuai speed: instant = hasil akhir saja, short = awal/tengah/akhir (edit pesan),
 * lengthy = setiap turn. `send(embed, files)` mengirim pesan baru dan mengembalikan pesan (punya edit()).
 * Mode display "image" menggambar tim dan bar HP/WP sebagai gambar (lihat battleImage.js);
 * kalau gambar gagal dibuat, dipakai embed teks.
 */
async function displayBattle(event, setting, send, { title, delayMs = 2000 } = {}) {
	if (!event.simulated || !event.initialized) return null;
	const opts = { display: setting.display, showLogs: !!setting.showLogs, title };
	const length = event.getLength();

	let turns = [length];
	if (setting.speed === 'short') turns = length <= 2 ? Array.from({ length: length + 1 }, (_, i) => i) : [0, Math.floor(length / 2), length];
	else if (setting.speed === 'lengthy') turns = Array.from({ length: length + 1 }, (_, i) => i);

	let msg;
	for (let i = 0; i < turns.length; i++) {
		const embed = renderTurn(event, turns[i], opts);
		let files = [];
		if (setting.display === 'image') {
			try {
				const name = `battle-${turns[i]}.png`;
				const png = await renderBattleImage(event.player.team, event.enemy.team, {
					playerName: event.player.name || `${event.playerName}'s team`,
					enemyName: event.enemy.name || `${event.enemyName}'s team`,
					turn: turns[i],
					length
				});
				files = [{ attachment: png, name }];
				delete embed.fields;
				embed.image = { url: `attachment://${name}` };
			} catch (error) {
				console.error('[BATTLE] Could not render battle image, using text:', error.message);
			}
		}
		if (!msg) msg = await send(embed, files);
		else await msg.edit({ embeds: [embed], files, attachments: [], allowedMentions: { parse: [] } }).catch(() => {});
		if (i < turns.length - 1) await sleep(setting.speed === 'lengthy' ? 2500 : delayMs);
	}
	return msg;
}

module.exports = { updateTeamStats, animalDisplayText, animalCompactText, parseLogs, renderTurn, finalText, displayBattle, weaponText, EMBED_COLOR };
