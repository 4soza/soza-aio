const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags
} = require('discord.js');
const crateDb = require('../../funeconomy/battle/crateDb');
const emojis = require('../../funeconomy/customEmoji');

const MAX_GRANT = 100_000;

function items(value) {
    return `${emojis.crate()} ${Math.floor(value || 0).toLocaleString('en-US')} weapon crates`;
}

module.exports = {
    category: 'fun',
    registerGuildOnly: true,
    data: new SlashCommandBuilder()
        .setName('addcrate')
        .setDescription('Add weapon crates to a user (bot creator only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option => option
            .setName('user')
            .setDescription('User who receives the weapon crates')
            .setRequired(true))
        .addIntegerOption(option => option
            .setName('amount')
            .setDescription(`Amount to add (1–${MAX_GRANT.toLocaleString()})`)
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(MAX_GRANT)),

    async execute(interaction) {
        const ownerId = process.env.DISCORD_USER_ID;
        if (!ownerId || !/^\d{17,20}$/.test(ownerId)) {
            return interaction.reply({
                content: 'This command is disabled. Set DISCORD_USER_ID to the bot creator’s Discord user ID.',
                flags: MessageFlags.Ephemeral
            });
        }
        if (interaction.user.id !== ownerId) {
            return interaction.reply({
                content: 'Only the configured bot creator can use this command.',
                flags: MessageFlags.Ephemeral
            });
        }

        const target = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const doc = await crateDb.addCrates(target.id, amount);
            return interaction.editReply({
                content: `Added **${items(amount)}** to **${target.username}**. New balance: **${items(doc?.boxcount)}**.`
            });
        } catch (error) {
            console.error('[FUNECONOMY] Owner addcrate grant failed:', error);
            return interaction.editReply({
                content: 'Weapon crates could not be added. Please try again later.'
            });
        }
    }
};
