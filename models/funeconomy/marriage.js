// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0 (https://github.com/ChristopherBThai/Discord-OwO-Bot)
const mongoose = require('mongoose');

// One document per couple. `users` holds both ids; the unique multikey index guarantees a user
// can never appear in two marriages, even with concurrent accepts.
const marriageSchema = new mongoose.Schema({
    users: { type: [String], required: true },
    ring: { type: Number, required: true, min: 1, max: 7 },
    marriedAt: { type: Date, default: Date.now },
    dailies: { type: Number, default: 0, min: 0 }
}, { timestamps: true });

marriageSchema.index({ users: 1 }, { unique: true });

module.exports = mongoose.models.FunMarriage || mongoose.model('FunMarriage', marriageSchema);
