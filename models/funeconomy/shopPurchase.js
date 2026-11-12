// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0 (https://github.com/ChristopherBThai/Discord-OwO-Bot)
const mongoose = require('mongoose');

// Daily weapon shop purchase marker: a user can buy each shop weapon once per day.
const purchaseSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    day: { type: Number, required: true },
    shopId: { type: Number, required: true }
}, { timestamps: true });

purchaseSchema.index({ userId: 1, day: 1, shopId: 1 }, { unique: true });

module.exports = mongoose.models.FunShopPurchase || mongoose.model('FunShopPurchase', purchaseSchema);
