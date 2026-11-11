// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
const { RANK_ORDER, RANKS, findAnimal, findRank } = require('./data');

const isCount = (t) => /^\d+$/.test(t) || String(t).toLowerCase() === 'all';
const toCount = (t) => (String(t).toLowerCase() === 'all' ? 'all' : parseInt(t, 10));

/**
 * Parse argumen sell/sacrifice (aturan OwO).
 * Return { ranks:[id] } | { animal, count } | { error: 'none'|'invalid'|'syntax-animal'|'syntax-rank'|'notfound' }.
 */
function parseExchangeArgs(args) {
    if (!args.length) return { error: 'none' };
    let name = null;
    let count = 1;
    if (args.length === 2 && isCount(args[0])) { count = toCount(args[0]); name = args[1]; }
    else if (args.length === 2 && isCount(args[1])) { count = toCount(args[1]); name = args[0]; }
    else if (args.length === 1) {
        if (args[0].toLowerCase() === 'all') return { ranks: [...RANK_ORDER] };
        name = args[0];
    } else {
        const ranks = [];
        for (const token of args) {
            const rank = findRank(token);
            if (!rank) return { error: 'invalid' };
            if (!ranks.includes(rank.id)) ranks.push(rank.id);
        }
        return { ranks };
    }
    const animal = findAnimal(name);
    if (animal) return args.length < 3 ? { animal, count } : { error: 'syntax-animal' };
    const rank = findRank(name);
    if (rank) return args.length === 1 ? { ranks: [rank.id] } : { error: 'syntax-rank' };
    return { error: 'notfound' };
}

/** "⚪x5 🟢x2" untuk hasil takeRanks. */
const rankSummary = (taken) =>
    RANK_ORDER.filter((id) => taken[id]).map((id) => `${RANKS[id].emoji}x${taken[id]}`).join(' ');

module.exports = { parseExchangeArgs, rankSummary };
