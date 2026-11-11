// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
const { displayName, send, onCooldown } = require('../utils');
const { RANKS, RANK_ORDER, ANIMALS, ANIMALS_BY_RANK, zooPoints } = require('../zoo/data');
const { getZoo } = require('../zoo/zooDb');
const { toSmallNum, chunkLines, BLANK } = require('../zoo/format');

// Rank yang menampilkan semua hewan (yang belum ditemukan jadi ❓)
const PLACEHOLDER_RANKS = new Set(['common', 'uncommon', 'rare', 'epic', 'mythical', 'legendary']);
const SCORE_LABEL = { hidden: 'H', fabled: 'F', bot: 'B', gem: 'G', legendary: 'L', mythical: 'M', epic: 'E', rare: 'R', uncommon: 'U', common: 'C' };
const SCORE_ORDER = ['hidden', 'fabled', 'bot', 'gem', 'legendary', 'mythical', 'epic', 'rare', 'uncommon', 'common'];

function buildZoo(name, docs, useTotal) {
    const shown = {};
    const totals = {};
    const rankTotals = {};
    let biggest = 0;
    for (const doc of docs) {
        const animal = ANIMALS[doc.name];
        if (!animal) continue;
        totals[doc.name] = doc.totalcount || 0;
        rankTotals[animal.rank] = (rankTotals[animal.rank] || 0) + (doc.totalcount || 0);
        const n = useTotal ? doc.totalcount : doc.count;
        if (n > 0) { shown[doc.name] = n; biggest = Math.max(biggest, n); }
    }
    const digits = Math.trunc(Math.log10(biggest || 1) + 1);

    const rows = [];
    for (const rankId of RANK_ORDER) {
        const keys = ANIMALS_BY_RANK[rankId];
        let cells;
        if (PLACEHOLDER_RANKS.has(rankId)) {
            cells = keys.map((k) => (shown[k] ? `${ANIMALS[k].uni}${toSmallNum(shown[k], digits)}` : `❓${toSmallNum(0, digits)}`));
        } else {
            cells = keys.filter((k) => shown[k]).map((k) => `${ANIMALS[k].uni}${toSmallNum(shown[k], digits)}`);
        }
        if (!cells.length) continue;
        let line = `${RANKS[rankId].emoji}    `;
        cells.forEach((cell, i) => {
            if (i && i % 5 === 0) line += `\n${BLANK}    `;
            line += `${cell}  `;
        });
        rows.push(line.trimEnd());
    }

    const points = zooPoints(totals);
    const score = SCORE_ORDER.filter((id) => rankTotals[id] > 0 || ['mythical', 'epic', 'rare', 'uncommon', 'common'].includes(id))
        .map((id) => `${SCORE_LABEL[id]}-${rankTotals[id] || 0}`).join(', ');
    const header = `🌿 🌱 🌳** ${name}'s zoo! **🌳 🌿 🌱`;
    const footer = `**Zoo Points: __${points.toLocaleString('en-US')}__**\n\t**${score}**`;
    return `${header}\n${rows.join('\n')}\n${footer}`;
}

module.exports = {
    name: 'zoo',
    aliases: ['z'],
    async execute(message, args) {
        if (onCooldown(message, 'zoo')) return;
        const display = ['display', 'd', '-display'].includes(String(args[0] || '').toLowerCase());
        const docs = await getZoo(message.author.id).catch(() => []);
        // hewan yang sudah habis dijual tetap tampil di mode display (totalcount)
        let all = docs;
        if (display) {
            const Animal = require('../../models/funeconomy/animal');
            all = await Animal.find({ userId: message.author.id, totalcount: { $gt: 0 } }).lean();
        }
        const text = buildZoo(displayName(message), all, display);
        for (const part of chunkLines(text)) await send(message, part);
    },
    _internals: { buildZoo }
};
