// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0 (https://github.com/ChristopherBThai/Discord-OwO-Bot)
const mongoose = require('mongoose');

// Penghitung auto-increment sederhana (mis. id senjata).
const counterSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 }
}, { versionKey: false });

module.exports = mongoose.models.FunCounter || mongoose.model('FunCounter', counterSchema);
