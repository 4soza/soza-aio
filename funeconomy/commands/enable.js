const { toggle } = require('../channelToggle');

// ${PREFIX}enable <all|command> : enable command Fun Economy di channel ini.
module.exports = {
    name: 'enable',
    aliases: [],
    alwaysOn: true, // tidak pernah ikut mati, dan tidak perlu registrasi
    execute: (message, args) => toggle(message, args, true)
};
