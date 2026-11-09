const mongoose = require('mongoose');

// Pengaturan command Fun Economy per channel (seperti enable/disable di OwO).
//   allDisabled = true  -> semua command mati, kecuali yang ada di `allowed`
//   allDisabled = false -> hanya command di `disabled` yang mati
const schema = new mongoose.Schema({
    channelId: { type: String, required: true, unique: true },
    guildId: { type: String, default: null },
    allDisabled: { type: Boolean, default: false },
    disabled: { type: [String], default: [] },
    allowed: { type: [String], default: [] }
}, { timestamps: true });

const Model = mongoose.models.FunChannelSettings || mongoose.model('FunChannelSettings', schema);

const CACHE_TTL_MS = 60 * 1000;
const DUPLICATE_KEY = 11000;
const cache = new Map();

const normalize = (doc) => ({
    allDisabled: Boolean(doc?.allDisabled),
    disabled: doc?.disabled || [],
    allowed: doc?.allowed || []
});

async function get(channelId) {
    const cached = cache.get(channelId);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;
    const value = normalize(await Model.findOne({ channelId }).lean());
    cache.set(channelId, { value, at: Date.now() });
    return value;
}

/** True kalau command `name` tidak boleh dipakai di channel ini. */
function isBlocked(settings, name) {
    return settings.allDisabled ? !settings.allowed.includes(name) : settings.disabled.includes(name);
}

async function isDisabled(channelId, name) {
    return isBlocked(await get(channelId), name);
}

async function update(channelId, guildId, change) {
    let doc;
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            doc = await Model.findOneAndUpdate(
                { channelId },
                { ...change, $setOnInsert: { channelId, guildId } },
                { upsert: true, new: true }
            ).lean();
            break;
        } catch (error) {
            if (error?.code !== DUPLICATE_KEY || attempt === 1) throw error;
        }
    }
    const value = normalize(doc);
    cache.set(channelId, { value, at: Date.now() });
    return value;
}

const disableAll = (channelId, guildId) =>
    update(channelId, guildId, { $set: { allDisabled: true, disabled: [], allowed: [] } });

const enableAll = (channelId, guildId) =>
    update(channelId, guildId, { $set: { allDisabled: false, disabled: [], allowed: [] } });

/** Aktifkan/matikan satu command (nama resmi). */
async function setCommand(channelId, guildId, name, enable) {
    const { allDisabled } = await get(channelId);
    const change = allDisabled
        ? (enable ? { $addToSet: { allowed: name } } : { $pull: { allowed: name } })
        : (enable ? { $pull: { disabled: name } } : { $addToSet: { disabled: name } });
    return update(channelId, guildId, change);
}

module.exports = { get, isBlocked, isDisabled, disableAll, enableAll, setCommand, _internals: { cache } };
