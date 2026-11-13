// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0 (https://github.com/ChristopherBThai/Discord-OwO-Bot)
// Marriage commands/buttons: propose, accept, decline, upgrade ring, display, divorce.
// customId (prefix fmarry):
//   fmarry:accept|decline:<senderId>:<receiverId>
//   fmarry:up:yes|no:<userId>:<ringId>
//   fmarry:div:yes|no:<userId>
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { track } = require('../inactivity');
const cfg = require('../config');
const { canEmbed, send, displayName } = require('../utils');
const { EMBED_COLOR } = require('../battle/battleDisplay');
const { fail, userName, resolveUser, isUserToken, isInt } = require('../battle/commandUtil');
const ringShop = require('./ringShop');
const db = require('./marriageDb');

const BUTTON_PREFIX = 'fmarry';
const GREY = 0x616161;
const DECLINE_EMOJI = '💔';
const HEARTS = ['❤️', '💛', '💚', '💙', '💜', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '🎊', '🎉', '🎀', '🎁'];
const QUOTES = ['How cute!', 'You look wonderful together!', 'You guys are adorable!', 'The perfect pair!', 'Too cute~!!!', 'Now kiss!'];
const QUOTES2 = ['（´・｀ ）♡', '(๑°꒵°๑)･*♡', '♡´･ᴗ･`♡', '(*´c_,｀*)', '(●´Д`●)', '(つω`●）', '(◕ᴗ◕✿)', '(●⌒ｖ⌒●)', '(´ ꒳ ` ✿)', 'OwO', '<3', ';3', 'c;'];
const DATE_OPTIONS = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };

const pick = (list, rng = Math.random) => list[Math.floor(rng() * list.length)];
const hearts = () => [pick(HEARTS), pick(HEARTS), pick(HEARTS)].join(' ');
const formatDate = (date) => new Date(date).toLocaleDateString('en-US', DATE_OPTIONS);
const ephemeral = (interaction, content) => interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });

/* Display name for a user id (fetch, with a fallback). */
async function nameOf(client, guild, id) {
    const cached = guild?.members?.cache?.get(id);
    if (cached) return cached.displayName;
    const user = await client?.users?.fetch?.(id).catch(() => null);
    return user ? (user.globalName || user.username) : 'someone';
}

/* Username (bukan display name) untuk user id. */
async function usernameOf(client, guild, id) {
    const cached = guild?.members?.cache?.get(id);
    if (cached?.user?.username) return cached.user.username;
    const user = await client?.users?.fetch?.(id).catch(() => null);
    return user?.username || 'someone';
}

/* URL gambar dari emoji kustom <:nama:id> / <a:nama:id>; null kalau emoji Unicode. */
function emojiImageUrl(emoji) {
    const m = /^<(a?):\w+:(\d+)>$/.exec(String(emoji || ''));
    return m ? `https://cdn.discordapp.com/emojis/${m[2]}.${m[1] ? 'gif' : 'png'}?size=128` : null;
}

const yesNo = (action, a, b, disabled = false) => [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${BUTTON_PREFIX}:${action}:yes:${a}${b !== undefined ? `:${b}` : ''}`).setLabel('Yes').setEmoji('✅').setStyle(ButtonStyle.Success).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`${BUTTON_PREFIX}:${action}:no:${a}${b !== undefined ? `:${b}` : ''}`).setLabel('No').setEmoji('❎').setStyle(ButtonStyle.Danger).setDisabled(disabled)
)];

const proposalButtons = (sender, receiver, disabled = false) => [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${BUTTON_PREFIX}:accept:${sender}:${receiver}`).setLabel('Accept').setEmoji('💍').setStyle(ButtonStyle.Success).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`${BUTTON_PREFIX}:decline:${sender}:${receiver}`).setLabel('Decline').setEmoji(DECLINE_EMOJI).setStyle(ButtonStyle.Danger).setDisabled(disabled)
)];

function proposalEmbed({ senderName, receiverName, ring, color = EMBED_COLOR, note }) {
    const p = cfg.PREFIX;
    return {
        author: { name: `${senderName} has proposed to ${receiverName} with a ${ring.name}!` },
        description: `${ring.emoji}${note ? `\n\n${note}` : ''}`,
        fields: [{
            name: 'Once you have accepted, you will be married and the ring will be used up!',
            value: `\`${p}am\` to accept  |  \`${p}dm\` to decline\nYou can divorce anytime with \`${p}divorce\` or upgrade your marriage ring with \`${p}marry @${receiverName} {ringID}\``
        }],
        color,
        footer: { text: `This proposal expires in ${db.PROPOSAL_MS / 60000} minutes` },
        timestamp: new Date().toISOString()
    };
}

/* Send an embed card with buttons, falling back to plain text when embeds are not allowed. */
function sendCard(message, embed, components, fallback) {
    const payload = canEmbed(message)
        ? { embeds: [embed], components, allowedMentions: { parse: [] } }
        : { content: fallback, components, allowedMentions: { parse: [] } };
    return message.channel.send(payload).then(track);
}

/* ---------- smarry @user {ring} ---------- */

function parseMarryArgs(args) {
    if (isUserToken(args[0]) && isInt(args[1])) return { userToken: args[0], ringId: parseInt(args[1], 10) };
    if (isUserToken(args[1]) && isInt(args[0])) return { userToken: args[1], ringId: parseInt(args[0], 10) };
    return null;
}

async function marry(message, args, client) {
    if (args.length <= 1) return display(message, client);
    const parsed = parseMarryArgs(args);
    if (!parsed) return fail(message, "invalid arguments! Please include the person you're marrying and the ring id.", 3000);
    const { ringId } = parsed;
    const ring = ringShop.getRing(ringId);
    if (!ring) return fail(message, "that's not a valid ring id!", 3000);

    const targetId = /\d+/.exec(parsed.userToken)[0];
    if (targetId === message.author.id) return fail(message, "silly. You can't marry yourself!", 3000);
    if (targetId === client?.user?.id) return fail(message, "sorry love! I'm already taken c;", 3000);
    const target = await resolveUser(message, parsed.userToken, client);
    if (!target) return fail(message, 'please tag a user to marry them!', 3000);
    if (target.bot) return fail(message, "you silly hooman! You can't marry a bot!", 3000);

    const result = await db.propose({ sender: message.author.id, receiver: target.id, ring: ring.id });
    switch (result.error) {
    case 'married-pair': return upgrade(message, ring, result.marriage);
    case 'married-sender': return fail(message, 'you are already married! Use `' + cfg.PREFIX + 'divorce` first.', 3000);
    case 'married-target': return fail(message, 'that user is already married!', 3000);
    case 'pending': return fail(message, 'you or your friend already has a marriage pending!');
    case 'noring': return fail(message, `You don't have this ring! Please buy one at \`${cfg.PREFIX}shop\`!`);
    default: break;
    }

    const senderName = userName(message.guild, message.author);
    const receiverName = userName(message.guild, target);
    const embed = proposalEmbed({ senderName, receiverName, ring });
    const fallback = `${ring.emoji} | **${senderName}** has proposed to **${receiverName}** with a ${ring.name}!\n`
        + `\`${cfg.PREFIX}am\` to accept  |  \`${cfg.PREFIX}dm\` to decline`;
    const sent = await sendCard(message, embed, proposalButtons(message.author.id, target.id), fallback);
    await db.setProposalMessage(result.proposal, message.channel.id, sent?.id ?? null).catch(() => {});

    // Disable the buttons once the proposal expires (best effort; the database check is what enforces expiry).
    const timer = setTimeout(async () => {
        const still = await db.getPending(message.author.id).catch(() => null);
        if (still) return;
        sent?.edit?.({
            embeds: [proposalEmbed({ senderName, receiverName, ring, color: GREY })],
            components: proposalButtons(message.author.id, target.id, true), allowedMentions: { parse: [] }
        })?.catch?.(() => {});
    }, db.PROPOSAL_MS + 1000);
    timer.unref?.();
    return sent;
}

/* Marry the spouse again with another ring = ring upgrade (confirmation with buttons). */
async function upgrade(message, newRing, marriage) {
    const name = displayName(message);
    const current = ringShop.getRing(marriage.ring);
    if (current.id === newRing.id) return fail(message, 'you silly. You are already using a ring with the same rarity!');
    if (await ringShop.getRingCount(message.author.id, newRing.id) < 1) {
        return fail(message, "you cannot upgrade your ring if you don't have it silly!", 3000);
    }
    const text = `**${name}**, are you sure you want to change your **${current.name}** to ${ringShop.article(newRing.name)} **${newRing.name}**?\n*You will not get your ring back!*`;
    const embed = { description: `${current.emoji} ${text}`, color: EMBED_COLOR };
    return sendCard(message, embed, yesNo('up', message.author.id, newRing.id), `${current.emoji} ${text}`);
}

/* ---------- smarry (no args) ---------- */

async function display(message, client) {
    const name = userName(message.guild, message.author);
    const marriage = await db.getMarriage(message.author.id);
    if (!marriage) {
        return fail(message, `you are not married! Please purchase and include the ring id in the command! ex. \`${cfg.PREFIX}marry @user {ringID}\``, 3000);
    }
    const ring = ringShop.getRing(marriage.ring);
    const partnerId = db.partnerOf(marriage, message.author.id);
    const partner = await usernameOf(client, message.guild, partnerId);
    const ringUrl = emojiImageUrl(ring.emoji);
    // Cincin di kanan (thumbnail) seperti OwO; kalau emoji Unicode, tetap di awal teks
    const body = `Married since **${formatDate(marriage.marriedAt)}** (**${db.marriedDays(marriage)} days**)\n`
        + `You have claimed **${marriage.dailies || 0} dailies** together!\n${pick(QUOTES)} ${pick(QUOTES2)}`;
    const description = ringUrl ? body : `${ring.emoji} ${body}`;
    const embed = { author: { name: `${name}, you are happily married to ${partner}!` }, description, color: EMBED_COLOR };
    if (ringUrl) embed.thumbnail = { url: ringUrl };
    if (!canEmbed(message)) return send(message, `${ring.emoji} | **${name}**, you are happily married to **${partner}**!\n${ringUrl ? `${ring.emoji} ` : ''}${description}`);
    return message.channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
}

/* ---------- accept / decline ---------- */

/* Text for a finished accept (null for errors, which are reported through `errorText`). */
function acceptResult(result, { senderName, receiverName }) {
    if (result.error === 'none') return { error: 'you do not have any pending marriage proposals!' };
    if (result.error === 'noring') return { error: 'the proposer no longer has that ring, so the proposal was cancelled!' };
    if (result.error === 'married') return { error: 'one of you is already married, so the proposal was cancelled!' };
    const ring = ringShop.getRing(result.marriage.ring);
    return { text: `${ring.emoji} | **${receiverName}** and **${senderName}** are now married! Congratulations!! ${hearts()}`, ring };
}

async function accept(message, client) {
    const result = await db.accept(message.author.id);
    const senderName = result.proposal ? await nameOf(client, message.guild, result.proposal.sender) : 'someone';
    const out = acceptResult(result, { senderName, receiverName: displayName(message) });
    if (out.error) return fail(message, out.error, 3000);
    return send(message, out.text);
}

const declineText = (name, result, otherName) =>
    `${DECLINE_EMOJI} | **${name}**, you have declined a marriage request ${result.role === 'sender' ? 'to' : 'from'} ${otherName}!`;

async function decline(message, client) {
    const result = await db.decline(message.author.id);
    if (result.error) return fail(message, 'you do not have any pending marriage proposals!', 3000);
    const otherId = result.role === 'sender' ? result.proposal.receiver : result.proposal.sender;
    const other = await nameOf(client, message.guild, otherId);
    return send(message, declineText(displayName(message), result, other));
}

/* ---------- divorce ---------- */

async function divorce(message, client) {
    const name = userName(message.guild, message.author);
    const marriage = await db.getMarriage(message.author.id);
    if (!marriage) return fail(message, "you can't divorce if you aren't married, silly butt!", 3000);
    const ring = ringShop.getRing(marriage.ring);
    const partner = await nameOf(client, message.guild, db.partnerOf(marriage, message.author.id));
    const description = `${ring.emoji} You married on **${formatDate(marriage.marriedAt)}** and have been married for **${db.marriedDays(marriage)}** days `
        + `and claimed **${marriage.dailies || 0}** dailies together... Once you divorce, the ring will break and disappear.`;
    const embed = { author: { name: `${name}, are you sure you want to divorce ${partner}?` }, description, color: EMBED_COLOR };
    return sendCard(message, embed, yesNo('div', message.author.id), `**${name}**, are you sure you want to divorce **${partner}**?\n${description}`);
}

/* ---------- buttons ---------- */

async function handleProposalButton(interaction, [, action, senderId, receiverId]) {
    const { client, guild, user } = interaction;
    if (action === 'accept') {
        if (user.id !== receiverId) return ephemeral(interaction, 'Only the person who was proposed to can accept!');
        const result = await db.accept(receiverId, { senderId });
        const senderName = await nameOf(client, guild, senderId);
        const out = acceptResult(result, { senderName, receiverName: userName(guild, user) });
        await interaction.update({ components: proposalButtons(senderId, receiverId, true) });
        return interaction.followUp({ content: out.error ? `${cfg.EMOJI.ERROR} | **${userName(guild, user)}**, ${out.error}` : out.text, allowedMentions: { parse: [] } });
    }
    // decline: the receiver declines, the sender cancels
    if (user.id !== receiverId && user.id !== senderId) return ephemeral(interaction, "This isn't your proposal!");
    const result = await db.decline(user.id, { senderId });
    await interaction.update({ components: proposalButtons(senderId, receiverId, true) });
    if (result.error) {
        return interaction.followUp({ content: `${cfg.EMOJI.ERROR} | **${userName(guild, user)}**, you do not have any pending marriage proposals!`, allowedMentions: { parse: [] } });
    }
    const other = await nameOf(client, guild, result.role === 'sender' ? receiverId : senderId);
    return interaction.followUp({ content: declineText(userName(guild, user), result, other), allowedMentions: { parse: [] } });
}

async function handleUpgradeButton(interaction, [, , choice, userId, ringIdText]) {
    if (interaction.user.id !== userId) return ephemeral(interaction, "This isn't your marriage!");
    const embed = interaction.message?.embeds?.[0];
    const base = embed?.description ?? interaction.message?.content ?? '';
    const finish = (note, extra = {}) => interaction.update({
        embeds: embed ? [{ description: `${base}\n\n${note}`, color: GREY }] : [], content: embed ? '' : `${base}\n\n${note}`,
        components: [], ...extra
    });
    if (choice === 'no') return finish('You decided not to upgrade');
    const newRing = ringShop.getRing(ringIdText);
    const result = await db.upgradeRing(userId, newRing.id);
    if (result.error === 'noring') return finish("🚫 I don't see the ring in your inventory... 😏");
    if (result.error === 'same') return finish('🚫 You are already using this ring!');
    if (result.error) return finish('🚫 You are currently not married...');
    return finish(`${newRing.emoji} You decided to change the ring!`);
}

async function handleDivorceButton(interaction, [, , choice, userId]) {
    if (interaction.user.id !== userId) return ephemeral(interaction, "This isn't your marriage!");
    const embed = interaction.message?.embeds?.[0];
    const base = embed?.description ?? interaction.message?.content ?? '';
    const finish = (note) => interaction.update({
        embeds: embed ? [{ author: embed.author, description: `${base}\n\n${note}`, color: GREY }] : [],
        content: embed ? '' : `${base}\n\n${note}`, components: []
    });
    if (choice === 'no') return finish('💝 You have decided to stay married!');
    const result = await db.divorce(userId);
    if (result.error) return finish("🚫 You aren't married anymore...");
    return finish('💔 You have decided to divorce.');
}

async function handleButton(interaction) {
    const parts = interaction.customId.split(':');
    try {
        if (parts[1] === 'accept' || parts[1] === 'decline') return await handleProposalButton(interaction, parts);
        if (parts[1] === 'up') return await handleUpgradeButton(interaction, parts);
        if (parts[1] === 'div') return await handleDivorceButton(interaction, parts);
    } catch (error) {
        console.error('[MARRIAGE] button failed:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'Something went wrong... Try again!', flags: MessageFlags.Ephemeral }).catch(() => {});
        }
    }
    return null;
}

module.exports = { BUTTON_PREFIX, parseMarryArgs, marry, display, accept, decline, divorce, upgrade, handleButton };
