// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0 (https://github.com/ChristopherBThai/Discord-OwO-Bot)
const cooldown = require('../cooldown');
const { canEmbed, send, onCooldown } = require('../utils');
const { fail } = require('../battle/commandUtil');
const shopView = require('../shop/shopView');

const WEAPON_ARGS = ['weapon', 'w', 'shard', 'weapons', 'weaponshard', 'shards', 'weaponshards'];
const WALLPAPER_ARGS = ['wallpaper', 'wp', 'wallpapers', 'background', 'backgrounds'];

// sshop = rings + weapon list | sshop weapon = detailed daily weapons
module.exports = {
    name: 'shop',
    aliases: ['market'],
    async execute(message, args) {
        const first = (args[0] || '').toLowerCase();
        if (WALLPAPER_ARGS.includes(first)) return fail(message, 'wallpapers are not available in this shop!', 3000);
        if (onCooldown(message, 'shop')) return;
        cooldown.start('shop', message.author.id);
        const mode = WEAPON_ARGS.includes(first) ? 'w' : 'm';
        const built = await shopView.buildPage(message.author.id, mode, 1, { avatarUrl: message.author.displayAvatarURL?.() });
        if (!canEmbed(message)) return send(message, built.plain);
        return message.channel.send({ embeds: built.embeds, components: built.components, allowedMentions: { parse: [] } });
    }
};
