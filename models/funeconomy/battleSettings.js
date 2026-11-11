// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0 (https://github.com/ChristopherBThai/Discord-OwO-Bot)
const mongoose = require('mongoose');

const battleSettingsSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    display: { type: String, enum: ['image', 'text', 'compact'], default: 'image' },
    speed: { type: Number, enum: [0, 1, 2], default: 1 },
    logs: { type: Number, enum: [0, 1, 2], default: 0 }
}, { timestamps: true });

module.exports = mongoose.models.FunBattleSettings || mongoose.model('FunBattleSettings', battleSettingsSchema);
