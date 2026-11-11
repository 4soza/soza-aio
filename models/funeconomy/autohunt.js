// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
const mongoose = require('mongoose');

// Dokumen HuntBot per user. efficiency/duration/cost/gain/exp/radar = total essence yang dipakai upgrade (XP trait).
const autohuntSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    essence: { type: Number, default: 0, min: 0 },
    total: { type: Number, default: 0, min: 0 },
    efficiency: { type: Number, default: 0, min: 0 },
    duration: { type: Number, default: 0, min: 0 },
    cost: { type: Number, default: 0, min: 0 },
    gain: { type: Number, default: 0, min: 0 },
    exp: { type: Number, default: 0, min: 0 },
    radar: { type: Number, default: 0, min: 0 },
    // huntmin > 0 = sedang berburu. startAt = ms epoch mulai.
    huntcount: { type: Number, default: 0, min: 0 },
    huntmin: { type: Number, default: 0, min: 0 },
    startAt: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.models.FunAutohunt || mongoose.model('FunAutohunt', autohuntSchema);
