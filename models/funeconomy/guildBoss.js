const mongoose = require('mongoose');

// Guild boss: satu boss aktif per server. HP boss dibagi bersama oleh semua pemain yang melawannya.
const animalSchema = new mongoose.Schema({
    key: { type: String, required: true },
    level: { type: Number, required: true },
    hp: { type: Number, required: true },
    hpMax: { type: Number, required: true },
    weapon: { type: Object, default: null } // { wid, stat, passives: [{ id, stat }], wear }
}, { _id: false });

const guildBossSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    no: { type: Number, default: 1 },
    level: { type: Number, default: 10 },
    status: { type: String, enum: ['active', 'defeated', 'fled'], default: 'active' },
    spawnedAt: { type: Date, default: Date.now },
    endsAt: { type: Date, required: true },
    animals: { type: [animalSchema], default: [] },
    damage: { type: Map, of: Number, default: {} },
    fighters: { type: [String], default: [] },
    rewards: {
        shards: { type: Number, default: 0 },
        crates: { type: Number, default: 1 },
        bossCrates: { type: Number, default: 1 },
        xp: { type: Number, default: 0 }
    }
}, { timestamps: true });

// Hanya satu boss aktif per server (spawn bersamaan tidak membuat boss ganda).
guildBossSchema.index({ guildId: 1 }, { name: 'one_active_boss_per_guild', unique: true, partialFilterExpression: { status: 'active' } });
// Untuk hitung boss yang sudah dikalahkan per server.
guildBossSchema.index({ guildId: 1, status: 1 });

module.exports = mongoose.models.FunGuildBoss || mongoose.model('FunGuildBoss', guildBossSchema);
