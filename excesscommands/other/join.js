const { runCommand, joinFromContext } = require('../../utils/voiceStay');

// s!join : Join your voice channel without playing music. (works only through the "s!" music prefix)
module.exports = {
    name: 'join',
    description: 'Join your voice channel without playing music.',
    async execute(message, args, client) {
        return runCommand(message, () => joinFromContext(message, client));
    },
};
