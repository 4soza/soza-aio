// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0 (https://github.com/ChristopherBThai/Discord-OwO-Bot)
const mongoose = require('mongoose');

// Weapon crate dan weapon shard per user.
const crateSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    boxcount: { type: Number, default: 0, min: 0 },
    // Crate yang ditemukan dari battle pada hari claimDay (maks 3 per hari)
    claimcount: { type: Number, default: 0, min: 0 },
    claimDay: { type: Number, default: -1 },
    shards: { type: Number, default: 0, min: 0 }
}, { timestamps: true });

module.exports = mongoose.models.FunCrate || mongoose.model('FunCrate', crateSchema);
