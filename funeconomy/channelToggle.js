const { PermissionsBitField } = require('discord.js');
const cfg = require('./config');
const ChannelSettings = require('../models/funeconomy/channelSettings');
const { displayName, send, errorLine } = require('./utils');

// Logika bersama senable / sdisable (seperti OwO): "senable all", "sdisable all", "sdisable <command>".
// Berlaku per channel. Hanya yang punya izin Manage Channel / Manage Server.
const GEAR = '⚙';

function canManage(message) {
    const permissions = message.channel.permissionsFor?.(message.member);
    return Boolean(
        permissions?.has(PermissionsBitField.Flags.ManageChannels) ||
        message.member?.permissions?.has(PermissionsBitField.Flags.ManageGuild)
    );
}

async function toggle(message, args, enable) {
    const verb = enable ? 'enable' : 'disable';
    const name = displayName(message);
    const target = args[0]?.toLowerCase();
    if (!target || args.length > 1) {
        return send(message, errorLine(name, `wrong arguments! Usage: \`${cfg.PREFIX}${verb} <all|command>\``));
    }
    if (!canManage(message)) {
        return send(message, errorLine(name, 'you need the **Manage Channel** permission to do this!'));
    }

    const channelId = message.channel.id;
    const guildId = message.guild.id;
    const state = enable ? 'enabled' : 'disabled';

    if (target === 'all') {
        await (enable ? ChannelSettings.enableAll : ChannelSettings.disableAll)(channelId, guildId);
        return send(message, `**${GEAR} | All** commands have been **${state}** for this channel!`);
    }

    const { commands } = require('./index'); // dimuat saat dipakai (index.js memuat file ini)
    const command = commands.get(target);
    if (!command) return send(message, errorLine(name, 'that command does not exist!'));
    if (command.alwaysOn) return send(message, errorLine(name, `you cannot ${verb} that command!`));

    await ChannelSettings.setCommand(channelId, guildId, command.name, enable);
    return send(message, `**${GEAR} | \`${command.name}\`** has been **${state}** for this channel!`);
}

module.exports = { toggle, canManage };
