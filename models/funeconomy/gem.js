// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0
const mongoose = require('mongoose');

// Satu dokumen per user.
//   gems:   { cgem1: 3, ... }              jumlah gem di inventory
//   active: { Hunting: { key, left }, ... } gem aktif per tipe (left = sisa pemakaian)
const gemSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    gems: { type: mongoose.Schema.Types.Mixed, default: {} },
    active: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true, minimize: false });

module.exports = mongoose.models.FunGem || mongoose.model('FunGem', gemSchema);
