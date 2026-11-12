const { BUTTON_PREFIX, handleButton } = require('../funeconomy/blackjack');
const register = require('../funeconomy/register');
const mines = require('../funeconomy/mines');
const highlow = require('../funeconomy/highlow');
const leaderboard = require('../funeconomy/leaderboardView');
const battleSettings = require('../funeconomy/battle/settingsView');
const battleButtons = require('../funeconomy/battle/battleButtons');
const shopView = require('../funeconomy/shop/shopView');
const marriageView = require('../funeconomy/shop/marriageView');
const { track } = require('../funeconomy/inactivity');

// Tombol blackjack (Hit/Stand), Register, Mines, HighLow, dan Leaderboard. Dimuat otomatis oleh handlers/events.js.
module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (!interaction.isButton()) return;

        if (interaction.customId.startsWith(`${register.BUTTON_PREFIX}:`)) {
            return register.handleButton(interaction);
        }
        if (interaction.customId.startsWith(`${BUTTON_PREFIX}:`)) {
            return handleButton(interaction, client);
        }
        if (interaction.customId.startsWith(`${mines.BUTTON_PREFIX}:`)) {
            return mines.handleButton(interaction);
        }
        if (interaction.customId.startsWith(`${highlow.BUTTON_PREFIX}:`)) {
            return highlow.handleButton(interaction);
        }
        if (interaction.customId.startsWith(`${battleButtons.BUTTON_PREFIX}:`)) {
            try { return await battleButtons.handleButton(interaction); } finally { track(interaction.message); }
        }
        if (interaction.customId.startsWith(`${shopView.BUTTON_PREFIX}:`)) {
            try { return await shopView.handleButton(interaction); } finally { track(interaction.message); }
        }
        if (interaction.customId.startsWith(`${marriageView.BUTTON_PREFIX}:`)) {
            try { return await marriageView.handleButton(interaction); } finally { track(interaction.message); }
        }
        if (interaction.customId.startsWith(`${battleSettings.BUTTON_PREFIX}:`)) {
            return battleSettings.handleButton(interaction).catch((error) => {
                console.error('[FUNECONOMY] Battle settings button failed:', error);
            });
        }
        if (interaction.customId.startsWith(`${leaderboard.BUTTON_PREFIX}:`)) {
            return leaderboard.handleButton(interaction).catch((error) => {
                console.error('[FUNECONOMY] Leaderboard button failed:', error);
            });
        }
    }
};
