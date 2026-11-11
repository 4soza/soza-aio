const mongoose = require('mongoose');

// Satu dokumen per (user, hewan). `count` = jumlah di zoo, `totalcount` = total yang pernah ditangkap.
// `xp` dipakai sebagai XP battle hewan tersebut (hewan yang masuk team).
const animalSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    name: { type: String, required: true },
    count: { type: Number, default: 0, min: 0 },
    totalcount: { type: Number, default: 0, min: 0 },
    xp: { type: Number, default: 0, min: 0 },
    nickname: { type: String, default: null },
    sellcount: { type: Number, default: 0, min: 0 },
    saccount: { type: Number, default: 0, min: 0 }
}, { timestamps: true });

animalSchema.index({ userId: 1, name: 1 }, { unique: true });
animalSchema.index({ userId: 1, xp: -1 });

module.exports = mongoose.models.FunAnimal || mongoose.model('FunAnimal', animalSchema);
