// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
const mongoose = require('mongoose');

// boxcount = lootbox yang dimiliki. claimcount = jumlah lootbox hasil hunt pada hari claimDay (maks 3 per hari).
const lootboxSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    boxcount: { type: Number, default: 0, min: 0 },
    claimcount: { type: Number, default: 0, min: 0 },
    claimDay: { type: Number, default: -1 }
}, { timestamps: true });

module.exports = mongoose.models.FunLootbox || mongoose.model('FunLootbox', lootboxSchema);
