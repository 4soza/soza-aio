const mongoose = require('mongoose');

// Satu game HighLow aktif per user. Disimpan di database supaya tombol tetap berfungsi setelah bot restart
// dan game bisa dilanjutkan dengan mengetik ulang "shl". Kartu 0-51 (format sama dengan blackjack).
// `cards` = semua kartu yang sudah terbuka; kartu terakhir = kartu saat ini (atau kartu yang membuat kalah).
const highLowSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    channelId: { type: String, default: null },
    messageId: { type: String, default: null },
    bet: { type: Number, required: true, min: 1 },
    cards: { type: [Number], required: true },
    streak: { type: Number, default: 0, min: 0 },
    pot: { type: Number, default: 0, min: 0 },
    lastGuess: { type: String, enum: ['higher', 'lower', 'same', null], default: null },
    status: {
        type: String,
        enum: ['pending', 'playing', 'lost', 'cashed_out'],
        default: 'pending'
    },
    payout: { type: Number, default: 0, min: 0 },
    version: { type: Number, default: 0, min: 0 }
}, { timestamps: true });

module.exports = mongoose.models.FunHighLow || mongoose.model('FunHighLow', highLowSchema);
