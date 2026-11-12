// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0 (https://github.com/ChristopherBThai/Discord-OwO-Bot)
const mongoose = require('mongoose');

// Ring inventory: one document per (user, ring id).
const ringSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    rid: { type: Number, required: true, min: 1, max: 7 },
    count: { type: Number, default: 0, min: 0 }
}, { timestamps: true });

ringSchema.index({ userId: 1, rid: 1 }, { unique: true });

module.exports = mongoose.models.FunRing || mongoose.model('FunRing', ringSchema);
