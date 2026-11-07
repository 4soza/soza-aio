const crypto = require('crypto');
const cfg = require('./config');

// Roulette Eropa: 37 kotak (0-36). 0 = hijau, 18 merah, 18 hitam.
const POCKETS = 37;
const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

// Kata yang boleh dipakai untuk memilih taruhan (Inggris + Indonesia).
const TARGET_ALIASES = {
    red: 'red', r: 'red', merah: 'red',
    black: 'black', b: 'black', hitam: 'black',
    green: 'green', g: 'green', hijau: 'green',
    odd: 'odd', ganjil: 'odd',
    even: 'even', genap: 'even',
    low: 'low', '1-18': 'low',
    high: 'high', '19-36': 'high'
};

const rl = () => cfg.ROULETTE || {};

function colorOf(number) {
    if (number === 0) return 'green';
    return RED_NUMBERS.has(number) ? 'red' : 'black';
}

/** "red" / "hitam" / "17" -> { kind } atau { kind: 'number', number }. Null kalau tidak dikenal. */
function parseTarget(token) {
    const t = String(token).toLowerCase();
    if (TARGET_ALIASES[t]) return { kind: TARGET_ALIASES[t] };
    if (/^\d{1,2}$/.test(t)) {
        const number = Number(t);
        if (number >= 0 && number < POCKETS) return { kind: 'number', number };
    }
    return null;
}

function isWin(target, number) {
    switch (target.kind) {
        case 'red':
        case 'black':
        case 'green':
            return colorOf(number) === target.kind;
        case 'odd': return number !== 0 && number % 2 === 1;
        case 'even': return number !== 0 && number % 2 === 0;
        case 'low': return number >= 1 && number <= 18;
        case 'high': return number >= 19 && number <= 36;
        case 'number': return number === target.number;
        default: return false;
    }
}

/** Kali lipat total (termasuk taruhan). Merah/hitam/ganjil/genap/low/high = 2x, satu angka atau hijau = 36x. */
function multiplierOf(target) {
    const single = target.kind === 'number' || target.kind === 'green';
    return single ? (rl().NUMBER_MULTIPLIER ?? 36) : (rl().EVEN_MONEY_MULTIPLIER ?? 2);
}

function payoutFor(target, number, bet) {
    return isWin(target, number) ? bet * multiplierOf(target) : 0;
}

function spin(randomInt = crypto.randomInt) {
    return randomInt(POCKETS);
}

module.exports = { POCKETS, RED_NUMBERS, colorOf, parseTarget, isWin, multiplierOf, payoutFor, spin };
