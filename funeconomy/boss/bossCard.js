/*
 * Gambar 3 kartu boss ("A Guild Boss Appeared!") dengan @napi-rs/canvas, terinspirasi tampilan OwO Bot.
 * Tiap kartu: level + nama, gambar hewan, bar HP merah, stat, dan senjata + passive.
 */
const { RANKS } = require('../zoo/data');
const emojis = require('../customEmoji');
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
    const STAT_ICON = { hp: emojis.get('stat_hp'), wp: emojis.get('stat_wp'), str: emojis.get('stat_str'), mag: emojis.get('stat_mag'), pr: emojis.get('stat_pr'), mr: emojis.get('stat_mr') };
    Object.values(STAT_ICON).forEach((e) => wanted.add(e));
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
        const stat = (key, value, sx, sy) => {
            drawEmoji(ctx, STAT_ICON[key], images.get(STAT_ICON[key]), sx, sy - 13, 16);
            ctx.textAlign = 'left';
            ctx.fillStyle = '#e8f3fb';
            ctx.font = font(13, 'bold');
            ctx.fillText(value, sx + 22, sy);
        };
        const sx = x + 18;
        stat('hp', fmt(hpMax), sx, y + 198);
        stat('wp', fmt(s.wp[1] + s.wp[3]), sx + 100, y + 198);
        stat('str', fmt(s.att[0] + s.att[1]), sx, y + 218);
        stat('mag', fmt(s.mag[0] + s.mag[1]), sx + 100, y + 218);
        stat('pr', WeaponInterface.resToPrettyPercent(s.pr), sx, y + 238);
        stat('mr', WeaponInterface.resToPrettyPercent(s.mr), sx + 100, y + 238);

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

/* Gambar satu hewan boss + bar HP (halaman detail tombol 🔍). Return Buffer PNG. */
async function renderBossAnimal(a) {
    ensureFont();
    const { createCanvas } = canvasLib();
    const W = 300, H = 120;
    const key = a.animal.uni || a.animal.value;
    const img = await loadEmoji(key);
    const canvas = createCanvas(W * SCALE, H * SCALE);
    const ctx = canvas.getContext('2d');
    ctx.scale(SCALE, SCALE);
    drawEmoji(ctx, key, img, W / 2 - 34, 6, 68);
    const hp = Math.max(0, Math.ceil(a.stats.hp[0]));
    const hpMax = Math.ceil(a.stats.hp[1] + a.stats.hp[3]);
    const bx = 8, bw = W - 16, by = 84, bh = 22;
    ctx.fillStyle = '#3a1418';
    roundRect(ctx, bx, by, bw, bh, 5);
    ctx.fill();
    if (hp > 0) {
        ctx.fillStyle = '#d63a3a';
        roundRect(ctx, bx, by, Math.max(8, bw * Math.min(1, hp / hpMax)), bh, 5);
        ctx.fill();
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = font(13, 'bold');
    ctx.fillText(`${fmt(hp)} / ${fmt(hpMax)}`, W / 2, by + 16);
    return canvas.toBuffer('image/png');
}

module.exports = { renderBossCards, renderBossAnimal };
