const { runCommand, leaveFromContext } = require('../../utils/voiceStay');

// s!leave : Leave the current voice channel. (works only through the "s!" music prefix)
module.exports = {
    name: 'leave',
    description: 'Leave the current voice channel.',
    async execute(message, args, client) {
        return runCommand(message, () => leaveFromContext(message, client));
    },
};
