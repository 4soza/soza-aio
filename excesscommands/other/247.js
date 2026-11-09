const { runCommand, set247FromContext } = require('../../utils/voiceStay');

// s!247 : Toggle 24/7 mode. (works only through the "s!" music prefix)
module.exports = {
    name: '247',
    description: 'Toggle 24/7 mode.',
    async execute(message, args, client) {
        return runCommand(message, () => set247FromContext(message, args, client));
    },
};
