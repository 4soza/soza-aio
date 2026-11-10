const { MessageFlags, PermissionFlagsBits } = require('discord.js');
const { entersState, joinVoiceChannel, VoiceConnectionStatus } = require('@discordjs/voice');
const VoicePresence = require('../models/voicePresence/VoicePresence');
const { IDLE_VOICE_STATUS, setVoiceChannelStatus } = require('./voiceChannelStatus');

const restoreJobs = new Map();
const restoreTimers = new Map();
const RESTORE_INTERVAL_MS = 60000;

function isSlashCommand(context) {
    return typeof context?.isChatInputCommand === 'function' && context.isChatInputCommand();
}

async function reply(context, content) {
    if (isSlashCommand(context)) {
        if (context.deferred || context.replied) {
            return context.editReply({ content });
        }
        return context.reply({ content, flags: MessageFlags.Ephemeral });
    }

    return context.reply({
        content,
        allowedMentions: { repliedUser: false }
    });
}

async function runCommand(context, action) {
    const slash = isSlashCommand(context);
    if (slash && !context.deferred && !context.replied) {
        await context.deferReply({ flags: MessageFlags.Ephemeral });
    }

    try {
        await reply(context, await action());
    } catch (error) {
        console.error('[VoiceStay] Command failed:', error?.message || error);
        await reply(context, error?.userMessage || error?.message || 'The voice command failed.')
            .catch(() => {});
    }
}

function getGuild(context) {
    return context.guild || null;
}

async function getActor(context) {
    const guild = getGuild(context);
    const userId = context.user?.id || context.author?.id;
    if (context.member?.voice) return context.member;
    return guild?.members?.cache?.get(userId)
        || await guild?.members?.fetch(userId).catch(() => null)
        || null;
}

function hasManageGuildPermission(context, member) {
    return Boolean(
        context.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ||
        member?.permissions?.has(PermissionFlagsBits.ManageGuild)
    );
}

async function getBotMember(guild) {
    return guild.members.me || guild.members.fetchMe();
}

function getVoiceOnlyConnections(client) {
    if (!(client.__voiceOnlyConnections instanceof Map)) {
        client.__voiceOnlyConnections = new Map();
    }
    return client.__voiceOnlyConnections;
}

function getVoiceOnlyConnection(client, guildId) {
    return getVoiceOnlyConnections(client).get(guildId) || null;
}

async function assertVoiceConnectPermission(guild, voiceChannel) {
    const botMember = await getBotMember(guild);
    if (botMember.permissions?.has(PermissionFlagsBits.Administrator)) {
        return botMember;
    }

    const permissions = voiceChannel.permissionsFor(botMember);
    const missingPermissions = [
        [PermissionFlagsBits.ViewChannel, 'View Channel'],
        [PermissionFlagsBits.Connect, 'Connect']
    ]
        .filter(([permission]) => !permissions?.has(permission))
        .map(([, name]) => name);

    if (missingPermissions.length) {
        throw new Error(`I need the ${missingPermissions.join(' and ')} permission in that voice channel.`);
    }
    return botMember;
}

function withTimeout(promise, ms, label) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Join lewat player Lavalink (Riffy), seperti bot musik lain. Dengan begitu `s!p` berikutnya langsung memakai
 * player yang sama: bot tidak perlu keluar lalu masuk voice lagi. Mengembalikan null kalau tidak ada node
 * yang terhubung atau gagal; pemanggil lalu memakai koneksi voice biasa (voice-only) seperti sebelumnya.
 */
async function connectWithPlayer(client, guild, voiceChannel, textChannelId) {
    const riffy = client.riffy;
    const node = (riffy?.leastUsedNodes || []).find((candidate) => candidate?.connected);
    if (!node || typeof riffy.createPlayer !== 'function') return null;

    let player;
    try {
        player = await withTimeout(riffy.createPlayer(node, {
            guildId: guild.id,
            voiceChannel: voiceChannel.id,
            textChannel: textChannelId || voiceChannel.id,
            deaf: true
        }), 15000, 'Lavalink voice connection');

        // Tunggu sampai Discord benar-benar menaruh bot di channel itu.
        const deadline = Date.now() + 10000;
        while (guild.members.me?.voice?.channelId !== voiceChannel.id) {
            if (Date.now() > deadline) throw new Error('Discord did not move the bot into the voice channel');
            await new Promise((resolve) => setTimeout(resolve, 250));
        }
        return player;
    } catch (error) {
        console.warn(`[VoiceStay] Player join failed in guild ${guild.id}, using a voice-only connection:`, error.message);
        if (player) {
            player.__voiceStayRecoveryDestroy = true;
            try { await player.destroy(); } catch { /* sudah hilang */ } finally { player.__voiceStayRecoveryDestroy = false; }
        }
        return null;
    }
}

async function connectVoiceOnly(client, guild, voiceChannel, textChannelId = null) {
    const botMember = await assertVoiceConnectPermission(guild, voiceChannel);
    const existing = client.riffy?.players.get(guild.id);
    const currentBotChannelId = botMember.voice.channelId;

    if (currentBotChannelId && currentBotChannelId !== voiceChannel.id) {
        throw new Error('I am already in another voice channel. Make me leave first.');
    }

    if (existing?.connected && existing.voiceChannel === voiceChannel.id) {
        await setVoiceChannelStatus(
            client,
            guild.id,
            existing.current?.info?.title || IDLE_VOICE_STATUS,
            voiceChannel.id
        );
        return { alreadyConnected: true };
    }

    const connections = getVoiceOnlyConnections(client);
    const currentConnection = connections.get(guild.id);
    if (
        currentConnection?.state.status === VoiceConnectionStatus.Ready &&
        currentConnection.joinConfig.channelId === voiceChannel.id
    ) {
        await setVoiceChannelStatus(client, guild.id, IDLE_VOICE_STATUS, voiceChannel.id);
        return { alreadyConnected: true };
    }

    if (currentConnection) {
        connections.delete(guild.id);
        currentConnection.destroy();
    }

    if (existing) {
        existing.__voiceStayRecoveryDestroy = true;
        try {
            await existing.destroy().catch(() => {});
        } finally {
            existing.__voiceStayRecoveryDestroy = false;
        }
    }

    const joinedPlayer = await connectWithPlayer(client, guild, voiceChannel, textChannelId);
    if (joinedPlayer) {
        await setVoiceChannelStatus(client, guild.id, IDLE_VOICE_STATUS, voiceChannel.id);
        return { player: joinedPlayer, alreadyConnected: false };
    }

    let connection;
    let rawPacketListener;
    let stateChangeListener;
    const handshakeEvents = {
        botVoiceState: false,
        voiceServer: false
    };

    try {
        if (!guild.voiceAdapterCreator) {
            throw new Error('The Discord voice adapter is not available for this server.');
        }

        rawPacketListener = packet => {
            if (packet?.d?.guild_id !== guild.id) return;

            if (packet.t === 'VOICE_SERVER_UPDATE') {
                handshakeEvents.voiceServer = true;
                console.log(`[VoiceStay] Discord sent a voice-server update for guild ${guild.id}.`);
            } else if (
                packet.t === 'VOICE_STATE_UPDATE' &&
                packet.d.user_id === client.user?.id
            ) {
                handshakeEvents.botVoiceState = true;
                console.log(
                    `[VoiceStay] Discord sent a bot voice-state update for guild ${guild.id} (${packet.d.channel_id ? 'channel assigned' : 'disconnected'}).`
                );
            }
        };
        client.on('raw', rawPacketListener);

        connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
            selfDeaf: true
        });
        connections.set(guild.id, connection);
        stateChangeListener = (oldState, newState) => {
            console.log(
                `[VoiceStay] Voice connection state in guild ${guild.id}: ${oldState.status} -> ${newState.status}.`
            );
        };
        connection.on('stateChange', stateChangeListener);
        connection.on('error', error => {
            console.error(`[VoiceStay] Discord voice connection error in guild ${guild.id}:`, error.message || error);
        });
        await entersState(connection, VoiceConnectionStatus.Ready, 30000);
        await setVoiceChannelStatus(client, guild.id, IDLE_VOICE_STATUS, voiceChannel.id);
        return { connection, alreadyConnected: false };
    } catch (error) {
        const connectionStatus = connection?.state?.status || 'not-created';
        if (connection && connections.get(guild.id) === connection) {
            connections.delete(guild.id);
        }
        connection?.destroy();
        console.error(`[VoiceStay] Could not join voice in guild ${guild.id}:`, {
            name: error?.name,
            code: error?.code,
            message: error?.message || String(error),
            connectionStatus,
            ...handshakeEvents
        });
        const userMessage = (
            error?.name === 'AbortError' &&
            connectionStatus === VoiceConnectionStatus.Signalling
        )
            ? 'Discord did not finish the voice handshake within 30 seconds (status Signalling). Permissions are fine; check the Railway Console for voice-state and voice-server events.'
            : `The Discord voice connection failed before it was ready (status ${connectionStatus}). Check the Railway Console for details.`;
        throw new Error(userMessage);
    } finally {
        if (rawPacketListener) client.off('raw', rawPacketListener);
        if (connection && stateChangeListener) {
            connection.off('stateChange', stateChangeListener);
        }
    }
}

function releaseVoiceOnlyConnection(client, guildId) {
    const connections = getVoiceOnlyConnections(client);
    const connection = connections.get(guildId);
    if (!connection) return false;

    connections.delete(guildId);
    connection.destroy();
    return true;
}

const NOT_IN_VOICE = 'You are not in a voice channel';
const NO_BOT_IN_VOICE = 'There are no bots in your voice channel';

function getBotVoiceChannelId(guild, client) {
    const player = client.riffy?.players.get(guild.id);
    const voiceOnlyConnection = getVoiceOnlyConnection(client, guild.id);
    return guild.members.me?.voice?.channelId
        || voiceOnlyConnection?.joinConfig?.channelId
        || (player?.connected ? player.voiceChannel : null)
        || null;
}

/**
 * Voice-only rule shared by join/leave/247: the user must be in a voice channel and,
 * unless `needsBot` is false (join), the bot must be in that same channel.
 */
function assertVoiceAccess(guild, member, client, { needsBot = true } = {}) {
    const userChannelId = member.voice?.channelId;
    if (!userChannelId) throw new Error(NOT_IN_VOICE);
    if (needsBot && getBotVoiceChannelId(guild, client) !== userChannelId) throw new Error(NO_BOT_IN_VOICE);
    return userChannelId;
}

async function joinFromContext(context, client) {
    const guild = getGuild(context);
    const member = await getActor(context);
    const voiceChannel = member?.voice?.channel;

    if (!guild || !member) throw new Error('This command can only be used in a server.');
    assertVoiceAccess(guild, member, client, { needsBot: false });

    const pinnedPresence = await VoicePresence.findOne({
        guildId: guild.id,
        enabled: true,
        mode247: true
    }).lean();
    if (pinnedPresence && pinnedPresence.channelId !== voiceChannel.id) {
        throw new Error(`24/7 mode is locked to <#${pinnedPresence.channelId}>.`);
    }

    const result = await connectVoiceOnly(client, guild, voiceChannel, context.channel?.id);
    return result.alreadyConnected
        ? `I am already in <#${voiceChannel.id}>. Nothing is playing.`
        : `Joined <#${voiceChannel.id}> without playing music.`;
}

async function leaveFromContext(context, client) {
    const guild = getGuild(context);
    const member = await getActor(context);
    if (!guild || !member) throw new Error('This command can only be used in a server.');

    const player = client.riffy?.players.get(guild.id);
    const botVoiceChannelId = assertVoiceAccess(guild, member, client);

    // Remove the idle/music status while the bot is still connected; a
    // voice-only join has no Riffy playerDestroy event to clear it later.
    await setVoiceChannelStatus(client, guild.id, '', botVoiceChannelId);

    if (player) await player.destroy().catch(() => {});
    releaseVoiceOnlyConnection(client, guild.id);

    const keepAlive = await VoicePresence.exists({
        guildId: guild.id,
        enabled: true,
        mode247: true
    });
    if (keepAlive) schedule247Restore(client, guild.id, 5000);
    return keepAlive
        ? 'Left the voice channel. 24/7 is still enabled, so I will rejoin shortly. Use `s!247` to disable it.'
        : 'Left the voice channel.';
}

async function set247FromContext(context, args, client) {
    const guild = getGuild(context);
    const member = await getActor(context);
    if (!guild || !member) throw new Error('This command can only be used in a server.');
    const currentChannelId = assertVoiceAccess(guild, member, client);
    if (!hasManageGuildPermission(context, member)) {
        throw new Error('Only admins or members with the Manage Server permission can change 24/7 mode.');
    }

    // "enable"/"disable" is still accepted; without it the command toggles (like s!autoplay).
    const typed = isSlashCommand(context)
        ? context.options.getString('action')
        : String(args?.[0] || '').toLowerCase();
    let enable;
    if (typed === 'enable') enable = true;
    else if (typed === 'disable') enable = false;
    else {
        const active = await VoicePresence.exists({ guildId: guild.id, enabled: true, mode247: true });
        enable = !active;
    }

    if (!enable) {
        await VoicePresence.deleteOne({ guildId: guild.id, mode247: true });
        const pendingRestore = restoreTimers.get(guild.id);
        if (pendingRestore) clearTimeout(pendingRestore);
        restoreTimers.delete(guild.id);
        return '247 has been disabled';
    }

    const player = client.riffy?.players.get(guild.id);
    const voiceOnlyConnection = getVoiceOnlyConnection(client, guild.id);
    const isConnected = Boolean(
        (voiceOnlyConnection?.state.status === VoiceConnectionStatus.Ready &&
            voiceOnlyConnection.joinConfig.channelId === currentChannelId) ||
        (player?.connected && player.voiceChannel === currentChannelId) ||
        (await getBotMember(guild)).voice?.channelId === currentChannelId
    );
    if (!isConnected) throw new Error(NO_BOT_IN_VOICE);

    const voiceChannel = guild.channels.cache.get(currentChannelId)
        || await guild.channels.fetch(currentChannelId).catch(() => null);
    if (!voiceChannel?.isVoiceBased?.()) {
        throw new Error('I could not find my voice channel. Use `s!join` to connect me again.');
    }
    await assertVoiceConnectPermission(guild, voiceChannel);

    await VoicePresence.findOneAndUpdate(
        { guildId: guild.id },
        {
            $set: {
                guildId: guild.id,
                channelId: voiceChannel.id,
                textChannelId: context.channel.id,
                enabled: true,
                mode247: true,
                requestedBy: member.id
            }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return '247 has been enabled';
}

async function restore247Guild(client, guildId) {
    if (restoreJobs.has(guildId)) return restoreJobs.get(guildId);

    const job = Promise.resolve().then(async () => {
        const presence = await VoicePresence.findOne({
            guildId,
            enabled: true,
            mode247: true
        }).lean();
        if (!presence || !client.user) return false;

        const guild = client.guilds.cache.get(guildId)
            || await client.guilds.fetch(guildId).catch(() => null);
        if (!guild) return false;

        const voiceChannel = guild.channels.cache.get(presence.channelId)
            || await guild.channels.fetch(presence.channelId).catch(() => null);
        if (!voiceChannel?.isVoiceBased?.()) {
            console.warn(`[VoiceStay] Saved 24/7 voice channel is unavailable in guild ${guildId}.`);
            return false;
        }

        const botMember = await getBotMember(guild).catch(() => null);
        if (!botMember) return false;
        const existing = client.riffy?.players.get(guildId);
        const voiceOnlyConnection = getVoiceOnlyConnection(client, guildId);
        if (
            voiceOnlyConnection?.state.status === VoiceConnectionStatus.Ready &&
            voiceOnlyConnection.joinConfig.channelId === voiceChannel.id
        ) {
            return true;
        }
        if (existing?.connected && existing.voiceChannel === voiceChannel.id) return true;
        if (
            (botMember.voice?.channelId && botMember.voice.channelId !== voiceChannel.id) ||
            (existing?.connected && existing.voiceChannel !== voiceChannel.id)
        ) {
            console.warn(`[VoiceStay] Bot is already connected to a different voice channel in guild ${guildId}.`);
            return false;
        }

        // A disable or channel change may happen while the restore job is
        // fetching guild/channel data. Recheck the persisted intent before
        // touching the active player or requesting a new voice connection.
        const stillEnabled = await VoicePresence.exists({
            guildId,
            channelId: presence.channelId,
            enabled: true,
            mode247: true
        });
        if (!stillEnabled) return false;

        if (existing) {
            existing.__voiceStayRecoveryDestroy = true;
            try {
                await existing.destroy().catch(() => {});
            } finally {
                existing.__voiceStayRecoveryDestroy = false;
            }
        }

        const stillEnabledBeforeJoin = await VoicePresence.exists({
            guildId,
            channelId: presence.channelId,
            enabled: true,
            mode247: true
        });
        if (!stillEnabledBeforeJoin) return false;

        try {
            await connectVoiceOnly(client, guild, voiceChannel, presence.textChannelId);
            console.log(`[VoiceStay] Restored 24/7 voice connection for guild ${guildId}.`);
            return true;
        } catch (error) {
            console.warn(`[VoiceStay] 24/7 reconnect failed for guild ${guildId}:`, error.message);
            return false;
        }
    });

    restoreJobs.set(guildId, job);
    try {
        return await job;
    } finally {
        if (restoreJobs.get(guildId) === job) restoreJobs.delete(guildId);
    }
}

async function restoreAll247(client) {
    try {
        const presences = await VoicePresence.find({
            enabled: true,
            mode247: true
        }).select('guildId').lean();
        for (const presence of presences) {
            const restored = await restore247Guild(client, presence.guildId);
            if (!restored) schedule247Restore(client, presence.guildId, 5000);
        }
    } catch (error) {
        console.error('[VoiceStay] Could not load saved 24/7 sessions:', error.message || error);
    }
}

function schedule247Restore(client, guildId, delayMs = 3000) {
    if (restoreTimers.has(guildId)) return;

    const timer = setTimeout(() => {
        restoreTimers.delete(guildId);
        restore247Guild(client, guildId).catch(error => {
            console.error(`[VoiceStay] Scheduled reconnect failed for guild ${guildId}:`, error.message || error);
        });
    }, delayMs);
    timer.unref?.();
    restoreTimers.set(guildId, timer);
}

function start247Monitoring(client) {
    if (client.__voiceStayMonitoring) return;
    client.__voiceStayMonitoring = true;

    client.riffy?.on('nodeConnect', () => {
        restoreAll247(client);
    });

    client.riffy?.on('playerDestroy', player => {
        if (player?.guildId && player.voiceChannel) {
            setVoiceChannelStatus(client, player.guildId, '', player.voiceChannel);
        }
        if (player?.guildId && !player.__voiceStayRecoveryDestroy) {
            schedule247Restore(client, player.guildId, 5000);
        }
    });

    client.on('voiceStateUpdate', async (oldState, newState) => {
        if (newState.id !== client.user?.id) return;

        try {
            const presence = await VoicePresence.findOne({
                guildId: newState.guild.id,
                enabled: true,
                mode247: true
            });
            if (!presence) return;

            if (newState.channelId) {
                if (presence.channelId !== newState.channelId) {
                    presence.channelId = newState.channelId;
                    await presence.save();
                }
            } else if (oldState.channelId) {
                schedule247Restore(client, newState.guild.id, 5000);
            }
        } catch (error) {
            console.error('[VoiceStay] Failed to process 24/7 voice state:', error.message || error);
        }
    });

    restoreAll247(client);
    const interval = setInterval(() => restoreAll247(client), RESTORE_INTERVAL_MS);
    interval.unref?.();
}

module.exports = {
    runCommand,
    joinFromContext,
    leaveFromContext,
    set247FromContext,
    releaseVoiceOnlyConnection,
    start247Monitoring,
    restoreAll247,
    schedule247Restore
};
