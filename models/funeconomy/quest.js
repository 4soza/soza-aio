const mongoose = require('mongoose');

// Progres task harian/mingguan dan quest per user.
// daily/weekly = { <kunci task>: jumlah }; dailyDay = nomor hari, weeklyWeek = nomor minggu progresnya.
const questSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    dailyDay: { type: Number, default: -1 },
    daily: { type: Object, default: {} },
    dailyClaimed: { type: Boolean, default: false },
    weeklyWeek: { type: Number, default: -1 },
    weekly: { type: Object, default: {} },
    weeklyClaimed: { type: Boolean, default: false },
    // Quest aktif (maks 3). done = target tercapai tapi hadiah belum diklaim.
    quests: {
        type: [{
            _id: false,
            qid: { type: Number, required: true },
            name: { type: String, required: true },
            level: { type: Number, default: 0 },
            prize: { type: String, default: 'cash' },
            count: { type: Number, default: 0 },
            locked: { type: Boolean, default: false },
            done: { type: Boolean, default: false }
        }],
        default: []
    },
    questDay: { type: Number, default: -1 },
    rerollDay: { type: Number, default: -1 }
}, { timestamps: true });

module.exports = mongoose.models.FunQuest || mongoose.model('FunQuest', questSchema);
