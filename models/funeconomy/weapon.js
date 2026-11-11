// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0 (https://github.com/ChristopherBThai/Discord-OwO-Bot)
const mongoose = require('mongoose');

// Satu dokumen per senjata. uwid = id unik global (dari FunCounter), ditampilkan base36.
const weaponSchema = new mongoose.Schema({
    uwid: { type: Number, required: true, unique: true },
    userId: { type: String, required: true },
    wid: { type: Number, required: true },
    stat: { type: [Number], default: [] },
    passives: { type: [{ id: Number, stat: [Number], _id: false }], default: [] },
    wear: { type: Number, default: 1 },
    avg: { type: Number, default: 0 },
    rrCount: { type: Number, default: 0 },
    rrAttempt: { type: Number, default: 0 },
    hasTT: { type: Boolean, default: false },
    kills: { type: Number, default: 0 },
    favorite: { type: Boolean, default: false },
    // Nama hewan (key) yang memegang senjata ini, atau null.
    animal: { type: String, default: null },
    // Hasil reroll yang menunggu konfirmasi.
    pending: { type: mongoose.Schema.Types.Mixed, default: null }
}, { timestamps: true });

weaponSchema.index({ userId: 1, uwid: -1 });
weaponSchema.index({ userId: 1, animal: 1 });

module.exports = mongoose.models.FunWeapon || mongoose.model('FunWeapon', weaponSchema);
