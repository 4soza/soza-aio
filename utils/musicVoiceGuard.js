'use strict';

// Music panel buttons may only be used by members who are in the same voice
// channel as the bot. Being the song requester or session owner is not enough,
// so people outside the call cannot pause/skip/stop music for everyone.

function getBotVoiceChannelId(interaction, player = null) {
    return interaction?.guild?.members?.me?.voice?.channelId
        || player?.voiceChannel
        || null;
}

function getUserVoiceChannelId(interaction) {
    return interaction?.member?.voice?.channelId || null;
}

function isInBotVoiceChannel(interaction, player = null) {
    const botChannelId = getBotVoiceChannelId(interaction, player);
    const userChannelId = getUserVoiceChannelId(interaction);
    return Boolean(botChannelId && userChannelId && botChannelId === userChannelId);
}

function notInVoiceMessage(interaction, player = null) {
    const botChannelId = getBotVoiceChannelId(interaction, player);
    const userChannelId = getUserVoiceChannelId(interaction);
    const botChannel = botChannelId ? `<#${botChannelId}>` : 'None';
    const userChannel = userChannelId ? `<#${userChannelId}>` : 'None';
    return '**🚫 VOICE CHANNEL REQUIRED**\n\n'
        + 'Only listeners in the same voice channel as the bot can use these buttons.\n\n'
        + `**Bot Channel:** ${botChannel}\n`
        + `**Your Channel:** ${userChannel}`;
}

module.exports = {
    getBotVoiceChannelId,
    getUserVoiceChannelId,
    isInBotVoiceChannel,
    notInVoiceMessage,
};
