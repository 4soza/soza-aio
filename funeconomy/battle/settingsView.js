/*
 * Tampilan sbs ala OwO "User Settings" (Components V2).
 * Setiap setting punya tombol di samping; klik = ganti ke pilihan berikutnya.
 * Sesi kadaluarsa 10 menit sejak terakhir di-update (sama seperti leaderboard).
 */
const {
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
    SectionBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');
const cfg = require('../config');
const settingsDb = require('./settingsDb');
const { userName } = require('./commandUtil');

const BUTTON_PREFIX = 'fbs';
const ACCENT = 0x7ab8f5;
const ACCENT_EXPIRED = 0x4f545c;
const EXPIRE_MS = 10 * 60 * 1000;
const MAX_CHANGES = 5;
const timers = new Map(); // messageId -> { timeout, changes }

// values: urutan pilihan. Untuk speed & logs, index = angka yang disimpan di database.
const SETTINGS = [
    { key: 'display', id: 'battleDisplay', name: 'Battle Display', values: ['image', 'compact', 'text'], def: 'image', desc: 'Choose how battle messages are displayed.' },
    { key: 'speed', id: 'battleSpeed', name: 'Battle Speed', values: ['instant', 'short', 'lengthy'], def: 'short', desc: 'Choose how many battle progress messages are shown.' },
    { key: 'logs', id: 'battleLogs', name: 'Battle Logs', values: ['false', 'true', 'link'], def: 'false', desc: 'Choose how battle logs are shown. `true` always plays battles instantly.' }
];
const byKey = (key) => SETTINGS.find((s) => s.key === key);

function nextValue(key, current) {
    const { values } = byKey(key);
    const i = values.indexOf(current);
    return values[(i + 1) % values.length];
}

/* Nilai yang disimpan di database untuk pilihan ini */
const storedValue = (key, value) => (key === 'display' ? value : byKey(key).values.indexOf(value));

/** state: { ownerId, ownerName, settings: {display,speed,logs}, changes: [], updatedAt, expired } */
function build(state) {
    const expired = !!state.expired;
    const divider = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);
    const container = new ContainerBuilder().setAccentColor(expired ? ACCENT_EXPIRED : ACCENT);

    let header = `## Battle Settings\n-# ${state.ownerName}'s settings`;
    if (state.changes?.length) {
        header += '\n' + state.changes
            .map((c, i) => `${i + 1}. **${c.by}** changed \`${byKey(c.key).id}\` from \`${c.from}\` to \`${c.to}\``)
            .join('\n');
    }
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(header));
    container.addSeparatorComponents(divider());

    for (const s of SETTINGS) {
        const value = state.settings[s.key] ?? s.def;
        const text = `**\`${s.name}\`**\nType: \`enum\` | Default: \`${s.def}\`\n*${s.desc}*`;
        const button = new ButtonBuilder()
            .setCustomId(`${BUTTON_PREFIX}:${s.key}:${state.ownerId}`)
            .setStyle(ButtonStyle.Secondary)
            .setLabel(`☰ ${value}`)
            .setDisabled(expired);
        container.addSectionComponents(new SectionBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(text))
            .setButtonAccessory(button));
    }

    container.addSeparatorComponents(divider());
    const sec = Math.floor((state.updatedAt ?? Date.now()) / 1000);
    const footer = expired
        ? `-# This session has expired • Use \`${cfg.PREFIX}bs\` to open it again`
        : `-# Click a button to change a setting • Last updated: <t:${sec}:R>`;
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(footer));

    return { components: [container], allowedMentions: { parse: [] } };
}

function schedule(msg, state) {
    const old = timers.get(msg.id);
    if (old) clearTimeout(old.timeout);
    const timeout = setTimeout(() => {
        timers.delete(msg.id);
        msg.edit(build({ ...state, expired: true })).catch(() => {});
    }, EXPIRE_MS);
    timers.set(msg.id, { timeout, changes: state.changes });
}

/** Kirim tampilan settings. change (opsional) = perubahan dari sbs display=... */
async function send(message, change) {
    const settings = await settingsDb.getRawSettings(message.author.id);
    const state = {
        ownerId: message.author.id,
        ownerName: userName(message.guild, message.author),
        settings,
        changes: change ? [change] : [],
        updatedAt: Date.now()
    };
    const sent = await message.channel.send({ ...build(state), flags: MessageFlags.IsComponentsV2 });
    schedule(sent, state);
    return sent;
}

async function handleButton(interaction) {
    const [, key, ownerId] = interaction.customId.split(':');
    if (interaction.user.id !== ownerId) {
        return interaction.reply({
            content: `${cfg.EMOJI.ERROR} | These settings aren't yours! Use \`${cfg.PREFIX}bs\` to open your own.`,
            flags: MessageFlags.Ephemeral
        });
    }
    const msg = interaction.message;
    const ownerName = userName(interaction.guild, interaction.user);
    const session = timers.get(msg.id);
    const lastUpdated = msg.editedTimestamp ?? msg.createdTimestamp;

    await interaction.deferUpdate();
    // Fallback (bot sempat restart & timer hilang): kunci kalau sudah > 10 menit.
    if (!session && Date.now() - lastUpdated >= EXPIRE_MS) {
        const settings = await settingsDb.getRawSettings(ownerId);
        return interaction.editReply(build({ ownerId, ownerName, settings, changes: [], updatedAt: lastUpdated, expired: true }));
    }
    if (!byKey(key)) return;

    const settings = await settingsDb.getRawSettings(ownerId);
    const from = settings[key];
    const to = nextValue(key, from);
    await settingsDb.setBattleSetting(ownerId, key, storedValue(key, to));
    settings[key] = to;

    const changes = [...(session?.changes ?? []), { by: ownerName, key, from, to }].slice(-MAX_CHANGES);
    const state = { ownerId, ownerName, settings, changes, updatedAt: Date.now() };
    await interaction.editReply(build(state));
    schedule(msg, state);
}

module.exports = { BUTTON_PREFIX, EXPIRE_MS, SETTINGS, nextValue, storedValue, build, send, handleButton };
