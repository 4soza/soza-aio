/*
 * Gambar battle (dua tim, bar HP/WP, senjata) memakai @napi-rs/canvas.
 * Terinspirasi tampilan battle OwO Bot (CC BY-NC-SA 4.0), digambar ulang untuk bot ini.
 *
 * Emoji digambar dari gambar Twemoji (diunduh sekali lalu disimpan di memori) supaya tidak
 * bergantung pada font emoji di server. Kalau unduhan gagal, dipakai font emoji sistem.
 */
const path = require('path');
// Dimuat saat dipakai, supaya modul lain tetap bisa dimuat kalau canvas tidak terpasang.
const canvasLib = () => require('@napi-rs/canvas');

const FONT = 'SozaBattleFont';
let fontReady = false;
function ensureFont() {
    if (fontReady) return;
    fontReady = true;
    try {
        canvasLib().GlobalFonts.registerFromPath(path.join(__dirname, '../../UI/fonts/AfacadFlux-Regular.ttf'), FONT);
    } catch { /* pakai font sistem */ }
}
const font = (size, weight = 'bold') => `${weight} ${size}px ${FONT}, 'Segoe UI', Arial, sans-serif`;

const TWEMOJI_URL = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/72x72/';
const FETCH_TIMEOUT_MS = 4000;
const emojiCache = new Map(); // codepoints -> Promise<Image|null>
let emojiLoader = (url) => canvasLib().loadImage(url);

/** Nama file Twemoji untuk satu emoji (aturan: buang FE0F kecuali ada ZWJ). */
function twemojiCode(emoji) {
    const raw = String(emoji || '');
    const text = raw.includes('‍') ? raw : raw.replace(/️/g, '');
    const codes = [];
    for (const ch of text) codes.push(ch.codePointAt(0).toString(16));
    return codes.join('-');
}

function loadEmoji(emoji) {
    const code = twemojiCode(emoji);
    if (!code) return Promise.resolve(null);
    if (!emojiCache.has(code)) {
        const attempt = Promise.race([
            emojiLoader(`${TWEMOJI_URL}${code}.png`),
            new Promise((resolve) => setTimeout(() => resolve(null), FETCH_TIMEOUT_MS))
        ]).catch(() => null);
        // Gagal tidak disimpan supaya bisa dicoba lagi di battle berikutnya.
        emojiCache.set(code, attempt.then((img) => { if (!img) emojiCache.delete(code); return img; }));
    }
    return emojiCache.get(code);
}

function drawEmoji(ctx, emoji, img, x, y, size) {
    if (img) {
        ctx.drawImage(img, x, y, size, size);
        return;
    }
    ctx.save();
    ctx.font = `${Math.round(size * 0.82)}px ${FONT}, 'Noto Color Emoji', 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(String(emoji || '?'), x + size / 2, y + size / 2 + 2);
    ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function fit(ctx, text, maxWidth) {
    let t = String(text ?? '');
    if (ctx.measureText(t).width <= maxWidth) return t;
    while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
    return `${t}…`;
}

const nonNeg = (n) => Math.max(0, Math.ceil(Number(n) || 0));

/** Ringkas data satu hewan untuk digambar. */
function describe(animal) {
    const s = animal.stats;
    const weapon = animal.weapon;
    return {
        icon: animal.animal?.uni || animal.animal?.value || '❔',
        name: animal.nickname || animal.animal?.name || '?',
        lvl: s.lvl,
        hp: nonNeg(s.hp[0]),
        hpMax: nonNeg(s.hp[1] + s.hp[3]),
        wp: nonNeg(s.wp[0]),
        wpMax: nonNeg(s.wp[1] + s.wp[3]),
        weaponIcons: weapon ? [weapon.rank?.emoji, weapon.emoji, ...(weapon.passives || []).map((p) => p.emoji)].filter(Boolean) : [],
        quality: weapon ? weapon.avgQuality : null,
        buffIcons: (animal.buffs || []).map((b) => b.emoji).filter(Boolean)
    };
}

const W = 960;
const PAD = 24;
const CARD_W = 420;
const CARD_H = 116;
const GAP = 14;
const HEADER_H = 52;
const SCALE = 2;

/**
 * Gambar state battle saat ini (state hewan sudah disesuaikan dengan turn yang ditampilkan).
 * `info` = { playerName, enemyName, turn, length }. Return Buffer PNG.
 */
async function renderBattleImage(playerTeam, enemyTeam, info = {}) {
    ensureFont();
    const { createCanvas } = canvasLib();
    const left = playerTeam.map(describe);
    const right = enemyTeam.map(describe);
    const rows = Math.max(left.length, right.length, 1);
    const H = HEADER_H + rows * (CARD_H + GAP) + PAD - 4;

    // Muat semua emoji sekaligus (paralel) sebelum menggambar.
    const wanted = new Set();
    for (const a of [...left, ...right]) {
        wanted.add(a.icon);
        a.weaponIcons.forEach((e) => wanted.add(e));
        a.buffIcons.forEach((e) => wanted.add(e));
    }
    const images = new Map(await Promise.all([...wanted].map(async (e) => [e, await loadEmoji(e)])));

    const canvas = createCanvas(W * SCALE, H * SCALE);
    const ctx = canvas.getContext('2d');
    ctx.scale(SCALE, SCALE);

    // Latar
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0d1122');
    bg.addColorStop(1, '#161b36');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(70,120,255,0.07)';
    ctx.fillRect(0, 0, W / 2, H);
    ctx.fillStyle = 'rgba(255,70,90,0.07)';
    ctx.fillRect(W / 2, 0, W / 2, H);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(W / 2 - 1, HEADER_H - 8, 2, H - HEADER_H);

    // Judul tim
    ctx.textBaseline = 'alphabetic';
    ctx.font = font(22);
    ctx.fillStyle = '#e8ecff';
    ctx.textAlign = 'left';
    ctx.fillText(fit(ctx, info.playerName || 'Your team', CARD_W - 80), PAD, 34);
    ctx.textAlign = 'right';
    ctx.fillText(fit(ctx, info.enemyName || 'Enemy', CARD_W - 80), W - PAD, 34);
    if (info.length != null) {
        ctx.textAlign = 'center';
        ctx.font = font(14, 'normal');
        ctx.fillStyle = '#8f98c9';
        ctx.fillText(`Turn ${Math.min(info.turn ?? 0, info.length)}/${info.length}`, W / 2, 32);
    }

    const drawCard = (a, x, y, side) => {
        const dead = a.hp <= 0;
        ctx.save();
        if (dead) ctx.globalAlpha = 0.5;

        roundRect(ctx, x, y, CARD_W, CARD_H, 14);
        ctx.fillStyle = '#1b2142';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = side === 'player' ? '#3b5bdb' : '#c2415a';
        ctx.stroke();

        // Ikon hewan
        ctx.beginPath();
        ctx.arc(x + 14 + 30, y + 14 + 30, 32, 0, Math.PI * 2);
        ctx.fillStyle = '#10152e';
        ctx.fill();
        drawEmoji(ctx, a.icon, images.get(a.icon), x + 14 + 8, y + 14 + 8, 44);

        // Nama dan level
        const tx = x + 86;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#f2f4ff';
        ctx.font = font(17);
        ctx.fillText(fit(ctx, `L. ${a.lvl} ${a.name}`, 200), tx, y + 30);

        // Angka HP dan WP
        ctx.textAlign = 'right';
        ctx.font = font(13, 'normal');
        ctx.fillStyle = '#7ee0a1';
        ctx.fillText(`${a.hp}/${a.hpMax} HP`, x + CARD_W - 14, y + 28);
        ctx.fillStyle = '#7db4ff';
        ctx.fillText(`${a.wp}/${a.wpMax} WP`, x + CARD_W - 14, y + 46);

        // Bar HP
        const barW = CARD_W - 86 - 14;
        const bar = (by, h, ratio, color) => {
            roundRect(ctx, tx, by, barW, h, h / 2);
            ctx.fillStyle = '#0b0f22';
            ctx.fill();
            const w = Math.max(0, Math.min(1, ratio)) * barW;
            if (w > 0) {
                roundRect(ctx, tx, by, Math.max(w, h), h, h / 2);
                ctx.fillStyle = color;
                ctx.fill();
            }
        };
        bar(y + 56, 12, a.hpMax ? a.hp / a.hpMax : 0, a.hp / (a.hpMax || 1) > 0.3 ? '#2fbf71' : '#e0b43a');
        bar(y + 74, 8, a.wpMax ? a.wp / a.wpMax : 0, '#3d8bfd');

        // Senjata, passive, dan buff
        let ix = tx;
        const iy = y + 88;
        for (const e of a.weaponIcons) {
            drawEmoji(ctx, e, images.get(e), ix, iy, 22);
            ix += 26;
        }
        if (a.quality != null) {
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.font = font(13, 'normal');
            ctx.fillStyle = '#c7cdf2';
            ctx.fillText(`${a.quality}%`, ix + 2, iy + 12);
            ix += ctx.measureText(`${a.quality}%`).width + 12;
        }
        for (const e of a.buffIcons) {
            if (ix + 22 > x + CARD_W - 10) break;
            drawEmoji(ctx, e, images.get(e), ix, iy, 22);
            ix += 26;
        }
        ctx.restore();
    };

    left.forEach((a, i) => drawCard(a, PAD, HEADER_H + i * (CARD_H + GAP), 'player'));
    right.forEach((a, i) => drawCard(a, W - PAD - CARD_W, HEADER_H + i * (CARD_H + GAP), 'enemy'));

    // Lingkaran VS
    const cy = HEADER_H + (rows * (CARD_H + GAP) - GAP) / 2;
    ctx.beginPath();
    ctx.arc(W / 2, cy, 26, 0, Math.PI * 2);
    ctx.fillStyle = '#10152e';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#4a5390';
    ctx.stroke();
    ctx.fillStyle = '#e8ecff';
    ctx.font = font(18);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('VS', W / 2, cy + 1);

    return canvas.toBuffer('image/png');
}

module.exports = { renderBattleImage, twemojiCode, describe, _setEmojiLoader: (fn) => { emojiLoader = fn; emojiCache.clear(); } };
