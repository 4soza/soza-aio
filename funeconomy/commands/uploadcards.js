const fs = require('fs');
const path = require('path');
const { isBotOwner } = require('../../utils/botOwnerOnly');

// Perintah sekali pakai: unggah emoji kartu (PNG + GIF flip) ke Application Emojis bot.
// Hanya pemilik bot (DISCORD_USER_ID). Data emoji dibaca dari funeconomy/cardEmojiData.json.
//   suploadcards            -> unggah yang belum ada
//   suploadcards replace     -> hapus lalu unggah ulang yang sudah ada
// Setelah selesai, file ini dan cardEmojiData.json boleh dihapus dari repo.
const DATA_FILE = path.join(__dirname, '..', 'cardEmojiData.json');
// Opsional: emoji tambahan (mis. ikon dadu footer blackjack: bj_dice).
const EXTRA_FILE = path.join(__dirname, '..', 'diceEmojiData.json');

const mimeOf = (name) => (name.endsWith('_flip') ? 'image/gif' : 'image/png');

module.exports = {
    name: 'uploadcards',
    aliases: [],
    async execute(message, args, client) {
        if (!isBotOwner(message)) return;

        if (!fs.existsSync(DATA_FILE)) {
            return message.reply({
                content: 'File `funeconomy/cardEmojiData.json` tidak ditemukan. Upload dulu ke repo.',
                allowedMentions: { repliedUser: false }
            });
        }

        const replace = String(args[0] || '').toLowerCase() === 'replace';
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        if (fs.existsSync(EXTRA_FILE)) Object.assign(data, JSON.parse(fs.readFileSync(EXTRA_FILE, 'utf8')));
        const names = Object.keys(data);
        const status = await message.reply({
            content: `Mengunggah ${names.length} emoji kartu...`,
            allowedMentions: { repliedUser: false }
        });

        await client.application.emojis.fetch();
        let uploaded = 0;
        let skipped = 0;
        const failed = [];

        for (const [index, name] of names.entries()) {
            try {
                const existing = client.application.emojis.cache.find((e) => e.name === name);
                if (existing && !replace) {
                    skipped += 1;
                } else {
                    if (existing) {
                        await client.application.emojis.delete(existing.id);
                        client.application.emojis.cache.delete(existing.id);
                    }
                    await client.application.emojis.create({
                        attachment: `data:${mimeOf(name)};base64,${data[name]}`,
                        name
                    });
                    uploaded += 1;
                }
            } catch (error) {
                failed.push(`${name}: ${error.message}`);
            }
            if ((index + 1) % 15 === 0 && index + 1 < names.length) {
                await status.edit(`Mengunggah emoji kartu... ${index + 1}/${names.length}`).catch(() => {});
            }
        }

        const lines = [
            `Selesai. Diunggah: **${uploaded}**, dilewati (sudah ada): **${skipped}**, gagal: **${failed.length}**.`
        ];
        if (failed.length) lines.push(`\`\`\`\n${failed.slice(0, 5).join('\n')}\n\`\`\``);
        return status.edit(lines.join('\n')).catch(() => message.channel.send(lines.join('\n')));
    }
};
