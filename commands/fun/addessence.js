const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags
} = require('discord.js');
const HuntBot = require('../../funeconomy/zoo/huntbot');
const emojis = require('../../funeconomy/customEmoji');

const MAX_GRANT = 100_000_000;

function essence(value) {
    return `${emojis.essence()} ${Math.floor(value || 0).toLocaleString('en-US')} Animal Essence`;
}

module.exports = {
    category: 'fun',
    registerGuildOnly: true,
    data: new SlashCommandBuilder()
        .setName('addessence')
        .setDescription('Add Animal Essence to a user (bot creator only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option => option
            .setName('user')
            .setDescription('User who receives the essence')
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
            await HuntBot.addEssence(target.id, amount);
            const doc = await HuntBot.get(target.id);
            return interaction.editReply({
                content: `Added **${essence(amount)}** to **${target.username}**. New balance: **${essence(doc?.essence)}**.`
            });
        } catch (error) {
            console.error('[FUNECONOMY] Owner essence grant failed:', error);
            return interaction.editReply({
                content: 'Essence could not be added. Please try again later.'
            });
        }
    }
};
