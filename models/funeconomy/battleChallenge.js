// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0 (https://github.com/ChristopherBThai/Discord-OwO-Bot)
const mongoose = require('mongoose');

// Tantangan battle teman + rekor menang/kalah. user1 < user2 (urutan string id).
const challengeSchema = new mongoose.Schema({
    user1: { type: String, required: true },
    user2: { type: String, required: true },
    sender: { type: String, default: null },
    flags: { type: String, default: '' },
    channelId: { type: String, default: null },
    messageId: { type: String, default: null },
    // null / lama = tidak ada tantangan aktif
    time: { type: Date, default: null },
    win1: { type: Number, default: 0 },
    win2: { type: Number, default: 0 },
    tie: { type: Number, default: 0 }
}, { timestamps: true });

challengeSchema.index({ user1: 1, user2: 1 }, { unique: true });

module.exports = mongoose.models.FunBattleChallenge || mongoose.model('FunBattleChallenge', challengeSchema);
