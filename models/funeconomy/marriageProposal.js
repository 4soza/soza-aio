// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0 (https://github.com/ChristopherBThai/Discord-OwO-Bot)
const mongoose = require('mongoose');

// Pending marriage proposal. `users` = [sender, receiver]; the unique multikey index allows only
// one pending proposal per user (as sender or receiver). The ring is only consumed on accept.
const proposalSchema = new mongoose.Schema({
    sender: { type: String, required: true },
    receiver: { type: String, required: true },
    users: { type: [String], required: true },
    ring: { type: Number, required: true, min: 1, max: 7 },
    status: { type: String, default: 'pending' },
    channelId: { type: String, default: null },
    messageId: { type: String, default: null },
    expiresAt: { type: Date, required: true }
}, { timestamps: true });

proposalSchema.index({ users: 1 }, { unique: true });
proposalSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.FunMarriageProposal || mongoose.model('FunMarriageProposal', proposalSchema);
