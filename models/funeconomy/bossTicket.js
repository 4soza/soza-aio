const mongoose = require('mongoose');

// Tiket boss per user: 3 per hari (reset tengah malam WIB). `used` = tiket yang sudah dipakai pada hari `day`.
const bossTicketSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    day: { type: Number, default: -1 },
    used: { type: Number, default: 0, min: 0 }
}, { timestamps: true });

module.exports = mongoose.models.FunBossTicket || mongoose.model('FunBossTicket', bossTicketSchema);
