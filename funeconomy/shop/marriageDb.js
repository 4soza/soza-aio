// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0 (https://github.com/ChristopherBThai/Discord-OwO-Bot)
// Marriage + proposal storage. Atomicity comes from unique multikey indexes on `users` (a person can be in only one
// marriage and one pending proposal) plus conditional updates. The ring is consumed only when a proposal is accepted.
const Marriage = require('../../models/funeconomy/marriage');
const Proposal = require('../../models/funeconomy/marriageProposal');
const ringShop = require('./ringShop');

const DUPLICATE_KEY = 11000;
const PROPOSAL_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const sortPair = (a, b) => (String(a) < String(b) ? [String(a), String(b)] : [String(b), String(a)]);
const either = (a, b) => ({ $or: [{ users: String(a) }, { users: String(b) }] });

async function getMarriage(userId) {
    return Marriage.findOne({ users: String(userId) }).lean();
}

const partnerOf = (marriage, userId) => marriage.users.find((id) => id !== String(userId));
const marriedDays = (marriage, now = Date.now()) => Math.max(0, Math.floor((now - new Date(marriage.marriedAt).getTime()) / DAY_MS));

/* Pending (not expired) proposal that involves the user as sender or receiver. */
async function getPending(userId, now = Date.now()) {
    return Proposal.findOne({ ...either(userId, userId), expiresAt: { $gt: new Date(now) } }).lean();
}

/*
 * Send a proposal. Return { proposal } or { error }:
 *   'married-sender' | 'married-target' | 'married-pair' (+ marriage, for the upgrade flow) | 'pending' | 'noring'.
 */
async function propose({ sender, receiver, ring }, now = Date.now()) {
    sender = String(sender);
    receiver = String(receiver);
    const existing = await Marriage.find(either(sender, receiver)).lean();
    if (existing.length) {
        const pair = existing.find((m) => m.users.includes(sender) && m.users.includes(receiver));
        if (pair) return { error: 'married-pair', marriage: pair };
        return { error: existing.some((m) => m.users.includes(sender)) ? 'married-sender' : 'married-target' };
    }

    await Proposal.deleteMany({ ...either(sender, receiver), expiresAt: { $lte: new Date(now) } });
    if (await getPending(sender, now) || await getPending(receiver, now)) return { error: 'pending' };
    if (await ringShop.getRingCount(sender, ring) < 1) return { error: 'noring' };

    try {
        const proposal = await Proposal.create({
            sender, receiver, users: [sender, receiver], ring, status: 'pending',
            expiresAt: new Date(now + PROPOSAL_MS)
        });
        return { proposal };
    } catch (error) {
        if (error?.code === DUPLICATE_KEY) return { error: 'pending' };
        throw error;
    }
}

async function setProposalMessage(proposal, channelId, messageId) {
    await Proposal.updateOne({ sender: proposal.sender, receiver: proposal.receiver }, { $set: { channelId, messageId } });
}

/*
 * Accept the proposal addressed to `receiverId` (optionally only if it comes from `senderId`).
 * Return { marriage, proposal } or { error: 'none'|'noring'|'married' }.
 */
async function accept(receiverId, { senderId, now = Date.now() } = {}) {
    receiverId = String(receiverId);
    const filter = { receiver: receiverId, status: 'pending', expiresAt: { $gt: new Date(now) } };
    if (senderId) filter.sender = String(senderId);
    // Atomic claim: only one accept can flip the status.
    const proposal = await Proposal.findOneAndUpdate(filter, { $set: { status: 'accepting' } }, { new: false }).lean();
    if (!proposal) return { error: 'none' };
    const done = () => Proposal.deleteOne({ sender: proposal.sender, receiver: proposal.receiver }).catch(() => {});

    try {
        if (await Marriage.findOne(either(proposal.sender, proposal.receiver)).lean()) return { error: 'married', proposal };
        if (!(await ringShop.takeRing(proposal.sender, proposal.ring))) return { error: 'noring', proposal };
        let marriage;
        try {
            marriage = await Marriage.create({
                users: sortPair(proposal.sender, proposal.receiver), ring: proposal.ring, marriedAt: new Date(now), dailies: 0
            });
        } catch (error) {
            await ringShop.addRing(proposal.sender, proposal.ring).catch(() => {});
            if (error?.code === DUPLICATE_KEY) return { error: 'married', proposal };
            throw error;
        }
        return { marriage, proposal };
    } finally {
        await done();
    }
}

/* Decline (receiver) or cancel (sender) the user's pending proposal. The ring was never consumed. */
async function decline(userId, { senderId, now = Date.now() } = {}) {
    userId = String(userId);
    const filter = { ...either(userId, userId), expiresAt: { $gt: new Date(now) } };
    if (senderId) filter.sender = String(senderId);
    const proposal = await Proposal.findOne(filter).lean();
    if (!proposal) return { error: 'none' };
    const removed = await Proposal.deleteOne({ sender: proposal.sender, receiver: proposal.receiver });
    if (!removed.deletedCount) return { error: 'none' };
    return { proposal, role: proposal.sender === userId ? 'sender' : 'receiver' };
}

/* Replace the ring of the user's marriage with one from their inventory (the old ring is lost, like OwO). */
async function upgradeRing(userId, ring) {
    const marriage = await getMarriage(userId);
    if (!marriage) return { error: 'notmarried' };
    if (marriage.ring === ring) return { error: 'same', marriage };
    if (!(await ringShop.takeRing(userId, ring))) return { error: 'noring' };
    const before = await Marriage.findOneAndUpdate(
        { users: String(userId), ring: { $ne: ring } }, { $set: { ring } }, { new: false }
    ).lean();
    if (!before) {
        await ringShop.addRing(userId, ring).catch(() => {});
        return { error: 'notmarried' };
    }
    return { marriage: { ...before, ring }, oldRing: before.ring };
}

/* Divorce: the marriage (and its ring) is deleted. No cost, like OwO. Return { marriage } or { error: 'notmarried' }. */
async function divorce(userId) {
    const marriage = await getMarriage(userId);
    if (!marriage) return { error: 'notmarried' };
    const removed = await Marriage.deleteOne({ users: String(userId) });
    if (!removed.deletedCount) return { error: 'notmarried' };
    return { marriage };
}

/* For the daily command: count one daily claimed together (OwO marriage.dailies). */
async function addDaily(userId) {
    await Marriage.updateOne({ users: String(userId) }, { $inc: { dailies: 1 } });
}

module.exports = {
    PROPOSAL_MS, sortPair, getMarriage, partnerOf, marriedDays, getPending,
    propose, setProposalMessage, accept, decline, upgradeRing, divorce, addDaily
};
