// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0 (https://github.com/ChristopherBThai/Discord-OwO-Bot)
const cfg = require('../config');
const teamUtil = require('../battle/teamUtil');
const challengeDb = require('../battle/challengeDb');
const { teamPage } = require('../battle/teamView');
const { track } = require('../inactivity');
const { ANIMALS } = require('../zoo/data');
const { sendEmbed, canEmbed, send, onCooldown } = require('../utils');
const cooldown = require('../cooldown');
const { fail, reply, userName, animalFromToken, isInt, TEAM_EMOJI } = require('../battle/commandUtil');

const BUSY = `You cannot change your team while you have a pending battle! Use \`${cfg.PREFIX}db\` to decline`;

async function display(message) {
    const doc = await teamUtil.getTeamDoc(message.author.id);
    const page = await teamPage(message.author.id, userName(message.guild, message.author),
        message.author.displayAvatarURL?.({ extension: 'png', size: 128 }), doc?.active || 0);
    if (!page) return fail(message, `you don't have a team! Create one with \`${cfg.PREFIX}team add {animalName}\`!`, 5000);
    if (!canEmbed(message)) return send(message, 'I need the Embed Links permission to show your team!');
    return track(await message.channel.send({ ...page, allowedMentions: { parse: [] } }));
}

const slotsText = (slots) => slots.map((key, i) => (key && ANIMALS[key] ? `[${i + 1}]${ANIMALS[key].uni} ` : '')).join('').trim();

async function add(message, args) {
    if (args.length <= 1) return fail(message, `the correct command is \`${cfg.PREFIX}team add {animal} {position}\`!`, 5000);
    const animal = animalFromToken(args[1]);
    if (!animal) return fail(message, 'I could not find this animal!', 3000);
    let pos;
    if (args[2] !== undefined) {
        pos = parseInt(args[2], 10);
        if (!isInt(args[2]) || pos < 1 || pos > 3) return fail(message, 'Invalid team position! It must be between `1-3`!', 3000);
    }
    const result = await teamUtil.addMember(message.author.id, animal.key, pos);
    if (result.error === 'duplicate') return fail(message, 'This animal is already in your team!', 3000);
    if (result.error === 'full') return fail(message, `Your team is full! Please specify a position with \`${cfg.PREFIX}team add {animal} {position}\`!`, 5000);
    if (result.error === 'notowned') return fail(message, 'you do not own this animal!', 3000);
    if (result.error) return fail(message, 'something went wrong... Try again!', 5000);
    return reply(message, TEAM_EMOJI, `Your team has been updated!\n▫️ **|** Your team: ${slotsText(result.slots)}`);
}

async function remove(message, args) {
    if (args.length < 2) return fail(message, `the correct command is \`${cfg.PREFIX}team remove {animal|position}\`!`, 5000);
    let target;
    if (isInt(args[1])) {
        target = parseInt(args[1], 10);
        if (target < 1 || target > 3) return fail(message, 'Invalid team position! It must be between `1-3`!', 3000);
    } else {
        const animal = animalFromToken(args[1]);
        if (!animal) return fail(message, 'I could not find this animal!', 3000);
        target = animal.key;
    }
    const result = await teamUtil.removeMember(message.author.id, target);
    if (result.error === 'empty') return fail(message, 'your team is already empty!', 3000);
    if (result.error === 'last') return fail(message, 'You need to keep at least one animal in the team!', 3000);
    if (result.error) return fail(message, 'I failed to remove that animal. Check your team with `' + cfg.PREFIX + 'team`!', 5000);
    return reply(message, TEAM_EMOJI, `Successfully changed the team!\n▫️ **|** Your team: ${slotsText(result.slots)}`);
}

async function rename(message, args) {
    if (args.length < 2) return fail(message, `the correct command is \`${cfg.PREFIX}team rename {name}\`!`, 5000);
    const result = await teamUtil.renameTeam(message.author.id, args.slice(1).join(' '));
    if (result.error === 'long') return fail(message, 'The team name is too long!', 3000);
    if (result.error === 'invalid') return fail(message, 'The name has invalid characters!', 3000);
    if (result.error === 'noteam') return fail(message, `You don't have a team! Please set one with \`${cfg.PREFIX}team add {animal}\``, 5000);
    return reply(message, TEAM_EMOJI, `You successfully changed your team name to: **${result.name}**`);
}

// steam [add|remove|rename]
module.exports = {
    name: 'team',
    aliases: ['squad', 'tm'],
    async execute(message, args) {
        const sub = (args[0] || '').toLowerCase();
        if (!args.length || sub === 'display') {
            if (onCooldown(message, 'team')) return;
            cooldown.start('team', message.author.id);
            return display(message);
        }
        const edit = ['set', 's', 'add', 'a', 'replace'].includes(sub) ? add
            : ['remove', 'delete', 'd'].includes(sub) ? remove
                : ['rename', 'r', 'name'].includes(sub) ? rename : null;
        if (!edit) return fail(message, `wrong subcommand! Use \`${cfg.PREFIX}team add|remove|rename\``, 3000);
        if (edit !== rename && await challengeDb.inBattle(message.author.id)) return fail(message, BUSY, 3000);
        if (onCooldown(message, 'team')) return;
        cooldown.start('team', message.author.id);
        return edit(message, args);
    }
};
