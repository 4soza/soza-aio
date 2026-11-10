const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags
} = require('discord.js');
const Economy = require('../../models/funeconomy/economy');

module.exports = {
    category: 'fun',
    registerGuildOnly: true,
    data: new SlashCommandBuilder()
        .setName('resetcash')
        .setDescription('Reset a user\'s cash to 0 (bot creator only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option => option
            .setName('user_id')
            .setDescription('Discord user ID whose cash will be reset')
            .setRequired(true)
            .setMinLength(17)
            .setMaxLength(20)),

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

        const userId = interaction.options.getString('user_id').trim();
        if (!/^\d{17,20}$/.test(userId)) {
            return interaction.reply({
                content: 'That is not a valid Discord user ID.',
                flags: MessageFlags.Ephemeral
            });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        try {
            const found = await Economy.resetCash(userId);
            return interaction.editReply({
                content: found
                    ? `Cash for user ID **${userId}** has been reset to **0**.`
                    : `User ID **${userId}** has no Fun Economy account yet, so nothing was reset.`
            });
        } catch (error) {
            console.error('[FUNECONOMY] Owner cash reset failed:', error);
            return interaction.editReply({
                content: 'Cash could not be reset. Please try again later.'
            });
        }
    }
};
