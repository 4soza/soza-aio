// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
const cfg = require('../config');

const SMALL = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
const DAY_MS = 24 * 60 * 60 * 1000;
const OFFSET_MS = cfg.TIMEZONE_OFFSET_HOURS * 60 * 60 * 1000;

const BLANK = cfg.EMOJI?.BLANK || '▫️';

/** 12 -> "¹²" (dipadatkan ke `digits` angka) */
function toSmallNum(count, digits) {
    let n = Math.max(0, Math.trunc(count));
    const len = digits || String(n).length;
    let out = '';
    for (let i = 0; i < len; i += 1) {
        out = SMALL[n % 10] + out;
        n = Math.trunc(n / 10);
    }
    return out;
}

/** Progress bar gaya OwO. */
function bar(current, max, length = 16) {
    const ratio = max > 0 ? current / max : 0;
    let out = '`[';
    for (let i = 0; i < length; i += 1) out += i < ratio * length ? '■' : '□';
    out += ']`';
    return { bar: out, percent: Math.trunc(ratio * 10000) / 100 };
}

const dayNumber = (now = Date.now()) => Math.floor((now + OFFSET_MS) / DAY_MS);
const msUntilReset = (now = Date.now()) => (dayNumber(now) + 1) * DAY_MS - OFFSET_MS - now;

/** 45123000 -> "12H 32M 3S" */
function hms(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(total / 3600)}H ${Math.floor((total % 3600) / 60)}M ${total % 60}S`;
}

/** "an" untuk kata berawalan u/e (aturan OwO), selain itu "a". */
const article = (word) => (/^[ue]/i.test(word) ? 'an' : 'a');

/** Pecah teks panjang jadi potongan <= 1900 karakter per baris. */
function chunkLines(text, max = 1900) {
    const parts = [];
    let cur = '';
    for (const line of String(text).split('\n')) {
        if (cur && cur.length + line.length + 1 > max) { parts.push(cur); cur = line; }
        else cur = cur ? `${cur}\n${line}` : line;
    }
    if (cur) parts.push(cur);
    return parts;
}

module.exports = { toSmallNum, bar, dayNumber, msUntilReset, hms, article, chunkLines, BLANK };
