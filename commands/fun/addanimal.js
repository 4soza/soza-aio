const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags
} = require('discord.js');
const { ANIMALS, RANKS } = require('../../funeconomy/zoo/data');
const zooDb = require('../../funeconomy/zoo/zooDb');

const MAX_GRANT = 1000;
const SPECIALS = Object.values(ANIMALS).filter((a) => a.rank === 'special');

module.exports = {
    category: 'fun',
    registerGuildOnly: true,
    data: new SlashCommandBuilder()
        .setName('addanimal')
        .setDescription('Give a special animal to a user (bot creator only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option => option
            .setName('user_id')
            .setDescription('Discord user ID who receives the animal')
            .setRequired(true)
            .setMinLength(17)
            .setMaxLength(20))
        .addStringOption(option => option
            .setName('animal')
            .setDescription('Special animal')
            .setRequired(true)
            .addChoices(...SPECIALS.map((a) => ({ name: a.key, value: a.key }))))
        .addIntegerOption(option => option
            .setName('amount')
            .setDescription(`Amount to add (1-${MAX_GRANT})`)
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

        const userId = interaction.options.getString('user_id').trim();
        if (!/^\d{17,20}$/.test(userId)) {
            return interaction.reply({ content: 'That is not a valid Discord user ID.', flags: MessageFlags.Ephemeral });
        }
        const key = interaction.options.getString('animal');
        const amount = interaction.options.getInteger('amount') ?? 1;
        const animal = ANIMALS[key];
        if (!animal || animal.rank !== 'special') {
            return interaction.reply({ content: 'That is not a special animal.', flags: MessageFlags.Ephemeral });
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            await zooDb.addAnimals(userId, { [key]: amount });
            return interaction.editReply({
                content: `Added **${amount}x** ${animal.uni} **${key}** (${RANKS.special.emoji} special) to user ID **${userId}**.`
            });
        } catch (error) {
            console.error('[FUNECONOMY] Owner animal grant failed:', error);
            return interaction.editReply({ content: 'Animal could not be added. Please try again later.' });
        }
    }
};
