const { toggle } = require('../channelToggle');

// ${PREFIX}disable <all|command> : disable command Fun Economy di channel ini.
module.exports = {
    name: 'disable',
    aliases: [],
    alwaysOn: true, // tidak pernah ikut mati, dan tidak perlu registrasi
    execute: (message, args) => toggle(message, args, false)
};
