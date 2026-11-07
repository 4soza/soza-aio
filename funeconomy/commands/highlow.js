const { startCommand } = require('../highlow');

module.exports = {
    name: 'hl',
    aliases: ['highlow'],
    async execute(message, args, client) {
        return startCommand(message, args, client);
    }
};
