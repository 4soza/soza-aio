/*
 * Gambar 3 kartu boss ("A Guild Boss Appeared!") dengan @napi-rs/canvas, terinspirasi tampilan OwO Bot.
 * Tiap kartu: level + nama, gambar hewan, bar HP merah, stat, dan senjata + passive.
 */
const { RANKS } = require('../zoo/data');
const WeaponInterface = require('../battle/WeaponInterface');
const { ensureFont, font, loadEmoji, drawEmoji, canvasLib } = require('../battle/battleImage');

const SCALE = 2;
const CARD_W = 226;
const CARD_H = 292;
const GAP = 12;
const PAD = 14;
const RANK_COLOR = { common: '#9aa7b2', uncommon: '#4ade80', rare: '#60a5fa', epic: '#c084fc', mythical: '#f87171', legendary: '#fb923c', fabled: '#facc15' };

const fmt = (n) => Math.max(0, Math.round(Number(n) || 0)).toLocaleString('en-US');
const cap = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

/* animals = hewan battle boss (dari bossService.buildAnimals, HP sudah sesuai database). Return Buffer PNG. */
async function renderBossCards(animals) {
    ensureFont();
    const { createCanvas } = canvasLib();
    const W = PAD * 2 + animals.length * CARD_W + (animals.length - 1) * GAP;
    const H = CARD_H + PAD * 2;

    const wanted = new Set();
    for (const a of animals) {
        wanted.add(a.animal.uni || a.animal.value);
        if (a.weapon) [a.weapon.rank?.emoji, a.weapon.emoji, ...a.weapon.passives.map((p) => p.emoji)].filter(Boolean).forEach((e) => wanted.add(e));
    }
    const images = new Map(await Promise.all([...wanted].map(async (e) => [e, await loadEmoji(e)])));

    const canvas = createCanvas(W * SCALE, H * SCALE);
    const ctx = canvas.getContext('2d');
    ctx.scale(SCALE, SCALE);

    animals.forEach((a, i) => {
        const x = PAD + i * (CARD_W + GAP);
        const y = PAD;
        const s = a.stats;
        const hp = Math.max(0, Math.ceil(s.hp[0]));
        const hpMax = Math.ceil(s.hp[1] + s.hp[3]);
        const dead = hp <= 0;
        const color = RANK_COLOR[a.animal.rank] || '#60a5fa';

        // kartu
        const bg = ctx.createLinearGradient(x, y, x, y + CARD_H);
        bg.addColorStop(0, '#16394f');
        bg.addColorStop(1, '#0c2230');
        ctx.fillStyle = bg;
        roundRect(ctx, x, y, CARD_W, CARD_H, 14);
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = color;
        ctx.stroke();

        // judul
        ctx.textAlign = 'center';
        ctx.fillStyle = '#cfe8f7';
        ctx.font = font(13, 'bold');
        ctx.fillText(`Lvl ${s.lvl}`, x + CARD_W / 2, y + 22);
        ctx.fillStyle = '#ffffff';
        ctx.font = font(16, 'bold');
        let title = `${cap(a.animal.rank)} ${a.animal.name}`;
        while (ctx.measureText(title).width > CARD_W - 20 && title.length > 4) title = title.slice(0, -2) + '…';
        ctx.fillText(title, x + CARD_W / 2, y + 44);

        // hewan
        const iconKey = a.animal.uni || a.animal.value;
        drawEmoji(ctx, iconKey, images.get(iconKey), x + CARD_W / 2 - 40, y + 56, 80);

        // bar HP
        const bx = x + 14, bw = CARD_W - 28, by = y + 150, bh = 22;
        ctx.fillStyle = '#3a1418';
        roundRect(ctx, bx, by, bw, bh, 6);
        ctx.fill();
        if (hp > 0) {
            ctx.fillStyle = '#d63a3a';
            roundRect(ctx, bx, by, Math.max(8, bw * Math.min(1, hp / hpMax)), bh, 6);
            ctx.fill();
        }
        ctx.fillStyle = '#ffffff';
        ctx.font = font(13, 'bold');
        ctx.fillText(`${fmt(hp)} / ${fmt(hpMax)}`, x + CARD_W / 2, by + 16);

        // stat (dua baris)
        const stat = (label, value, col, sx, sy) => {
            ctx.textAlign = 'left';
            ctx.fillStyle = col;
            ctx.font = font(12, 'bold');
            ctx.fillText(label, sx, sy);
            ctx.fillStyle = '#e8f3fb';
            ctx.fillText(value, sx + 30, sy);
        };
        const sx = x + 16;
        stat('HP', fmt(hpMax), '#f87171', sx, y + 196);
        stat('WP', fmt(s.wp[1] + s.wp[3]), '#60a5fa', sx + 100, y + 196);
        stat('STR', fmt(s.att[0] + s.att[1]), '#fb923c', sx, y + 214);
        stat('MAG', fmt(s.mag[0] + s.mag[1]), '#c084fc', sx + 100, y + 214);
        stat('PR', WeaponInterface.resToPrettyPercent(s.pr), '#fbbf24', sx, y + 232);
        stat('MR', WeaponInterface.resToPrettyPercent(s.mr), '#38bdf8', sx + 100, y + 232);

        // senjata + passive
        if (a.weapon) {
            const icons = [a.weapon.rank?.emoji, a.weapon.emoji, ...a.weapon.passives.map((p) => p.emoji)].filter(Boolean);
            const size = 30;
            const total = icons.length * size + (icons.length - 1) * 4;
            icons.forEach((e, k) => drawEmoji(ctx, e, images.get(e), x + (CARD_W - total) / 2 + k * (size + 4), y + CARD_H - 44, size));
        }

        if (dead) {
            ctx.fillStyle = 'rgba(0,0,0,0.62)';
            roundRect(ctx, x, y, CARD_W, CARD_H, 14);
            ctx.fill();
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ff6b6b';
            ctx.font = font(22, 'bold');
            ctx.fillText('DEFEATED', x + CARD_W / 2, y + CARD_H / 2 + 6);
        }
    });

    return canvas.toBuffer('image/png');
}

module.exports = { renderBossCards };
