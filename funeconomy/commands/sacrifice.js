// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
const cooldown = require('../cooldown');
const { fmt, displayName, send, sendTemporaryError, onCooldown } = require('../utils');
const { RANKS } = require('../zoo/data');
const { takeForExchange, takeRanks } = require('../zoo/zooDb');
const { parseExchangeArgs, rankSummary } = require('../zoo/args');
const { addEssence } = require('../zoo/huntbot');

const ESSENCE = '✨';
const err = (message, name, text) => sendTemporaryError(message, `**🚫 | ${name}**, ${text}`);

async function sacrificeAnimal(userId, animal, count) {
    const sold = await takeForExchange(userId, animal.key, count, 'saccount');
    if (!sold) return { error: 'notenough' };
    const total = sold * RANKS[animal.rank].essence;
    await addEssence(userId, total);
    return { sold, total };
}

async function sacrificeRanks(userId, rankIds) {
    const taken = await takeRanks(userId, rankIds, 'saccount');
    let total = 0;
    for (const [rank, n] of Object.entries(taken)) total += n * RANKS[rank].essence;
    if (!total) return { error: 'notenough' };
    await addEssence(userId, total);
    return { taken, total };
}

module.exports = {
    name: 'sacrifice',
    aliases: ['essence', 'butcher', 'sac', 'sc'],
    async execute(message, args) {
        const userId = message.author.id;
        const name = displayName(message);
        const parsed = parseExchangeArgs(args);

        if (parsed.error === 'none') return err(message, name, 'Please specify what rank/animal to sacrifice!');
        if (parsed.error === 'invalid') return err(message, name, 'Invalid arguments!');
        if (parsed.error === 'syntax-animal') return err(message, name, 'The correct syntax for sacrificing animals is `ssacrifice {animal} {count}`!');
        if (parsed.error === 'syntax-rank') return err(message, name, 'The correct syntax for sacrificing ranks is `ssacrifice {rank}`!');
        if (parsed.error === 'notfound') return err(message, name, 'I could not find that animal or rank!');
        if (parsed.animal && parsed.count !== 'all' && parsed.count <= 0) return err(message, name, 'You need to sacrifice more than 1 silly~');

        if (onCooldown(message, 'sacrifice')) return;
        cooldown.start('sacrifice', userId);

        if (parsed.ranks) {
            const result = await sacrificeRanks(userId, parsed.ranks);
            if (result.error) return err(message, name, "You don't have enough animals! >:c");
            return send(message, `**🔪 | ${name}** sacrificed **${rankSummary(result.taken)}** for a total of **${ESSENCE} ${fmt(result.total)}**`);
        }
        const result = await sacrificeAnimal(userId, parsed.animal, parsed.count);
        if (result.error) {
            return err(message, name, parsed.count === 'all'
                ? "You don't have enough animals! >:c"
                : "You can't sacrifice more than you have silly! >:c");
        }
        return send(message, `**🔪 | ${name}** sacrificed **${parsed.animal.uni}x${result.sold}** for **${ESSENCE} ${fmt(result.total)}**`);
    },
    _internals: { sacrificeAnimal, sacrificeRanks }
};
