/*
 * Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
 * (https://github.com/ChristopherBThai/Discord-OwO-Bot), adapted for this bot.
 */
const Settings = require('../../models/funeconomy/battleSettings');

const SPEEDS = ['instant', 'short', 'lengthy'];

/* Default OwO: display image, speed short, logs off */
async function getBattleSetting(userId) {
	const bs = { auto: true, display: 'image', speed: 'short', showLogs: false };
	const doc = await Settings.findOne({ userId }).lean();
	if (!doc) return bs;
	bs.speed = SPEEDS[doc.speed] || 'short';
	if (doc.display === 'text' || doc.display === 'compact') bs.display = doc.display;
	if (doc.logs === 1) { bs.showLogs = true; bs.speed = 'instant'; }
	else if (doc.logs === 2) bs.showLogs = 'link';
	return bs;
}

/* Nilai mentah yang tersimpan (tanpa efek logs=true -> instant), untuk tampilan sbs */
async function getRawSettings(userId) {
	const doc = await Settings.findOne({ userId }).lean();
	const display = doc?.display === 'text' || doc?.display === 'compact' ? doc.display : 'image';
	const speed = SPEEDS[doc?.speed] || 'short';
	const logs = ['false', 'true', 'link'][doc?.logs] || 'false';
	return { display, speed, logs };
}

/* field: display | speed | logs. value sudah divalidasi. */
async function setBattleSetting(userId, field, value) {
	await Settings.updateOne({ userId }, { $set: { [field]: value } }, { upsert: true })
		.catch((error) => { if (error?.code !== 11000) throw error; });
}

module.exports = { getBattleSetting, getRawSettings, setBattleSetting, SPEEDS };
