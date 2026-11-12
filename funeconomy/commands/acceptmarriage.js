// Based on OwO Bot by Christopher Thai, CC BY-NC-SA 4.0 (https://github.com/ChristopherBThai/Discord-OwO-Bot)
const marriageView = require('../shop/marriageView');

module.exports = {
    name: 'acceptmarriage',
    aliases: ['am'],
    execute: (message, args, client) => marriageView.accept(message, client)
};
