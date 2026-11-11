// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0 (https://github.com/ChristopherBThai/Discord-OwO-Bot)
const mongoose = require('mongoose');

// Satu dokumen per user. Tiap team punya 3 slot posisi (nama hewan atau null).
const teamSchema = new mongoose.Schema({
    name: { type: String, default: null },
    slots: { type: [String], default: [null, null, null] },
    streak: { type: Number, default: 0, min: 0 },
    highestStreak: { type: Number, default: 0, min: 0 }
}, { _id: false });

const funTeamSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    active: { type: Number, default: 0, min: 0 },
    teams: { type: [teamSchema], default: [] }
}, { timestamps: true });

module.exports = mongoose.models.FunTeam || mongoose.model('FunTeam', funTeamSchema);
