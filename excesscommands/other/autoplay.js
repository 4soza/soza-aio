const { toggleUserAutoplay } = require('../../utils/userAutoplay');
const { setRiffyAutoplayEnabled } = require('../../utils/riffyAutoplay');

// s!autoplay / s!ap : command pertama mengaktifkan autoplay, command berikutnya menonaktifkannya.
// Pengaturan tersimpan per orang, jadi tidak perlu diaktifkan lagi setiap kali.
module.exports = {
    name: 'autoplay',
    description: 'Toggle autoplay for yourself.',
    async execute(message, args, client) {
        // Hanya berlaku di voice channel: pengguna harus di voice channel, dan bot harus ada di voice channel yang sama.
        const userChannelId = message.member?.voice?.channelId;
        if (!userChannelId) return message.reply('You are not in a voice channel');

        const player = client.riffy?.players?.get(message.guild.id);
        const botChannelId = message.guild.members.me?.voice?.channelId || player?.voiceChannel;
        if (!botChannelId || botChannelId !== userChannelId) {
            return message.reply('There are no bots in your voice channel');
        }

        let enabled;
        try {
            enabled = await toggleUserAutoplay(message.author.id);
        } catch (error) {
            console.error('Prefix autoplay error:', error);
            return message.reply('Failed to change autoplay. Please try again later.');
        }

        // Kalau lagu orang ini sedang diputar, sinkronkan flag player supaya langsung berlaku.
        const requesterId = player?.current?.requester?.id ?? player?.current?.info?.requester?.id;
        if (player && requesterId === message.author.id) setRiffyAutoplayEnabled(player, enabled);

        return message.reply(`Autoplay has been ${enabled ? 'enabled' : 'disabled'}`);
    },
};
