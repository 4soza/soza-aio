const questView = require('../funeconomy/quests/questView');
const { track } = require('../funeconomy/inactivity');

// Tombol task/quest (fquest:...). Dimuat otomatis oleh handlers/events.js.
module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        if (!interaction.isButton() || !interaction.customId.startsWith(`${questView.BUTTON_PREFIX}:`)) return;
        try {
            await questView.handleButton(interaction);
        } catch (error) {
            console.error('[FUNECONOMY] Quest button failed:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'Something went wrong!', flags: 64 }).catch(() => {});
            }
        } finally {
            track(interaction.message);
        }
    }
};
