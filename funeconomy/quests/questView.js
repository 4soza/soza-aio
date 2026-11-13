/*
 * Tampilan task harian/mingguan dan quest (gaya checklist OwO), memakai Components V2.
 * customId: fquest:<tab>:<ownerId>:<tab|claim|reroll|lock>[:<qid>]   tab = daily | weekly | quests
 */
const emojis = require('../customEmoji');
const cfg = require('../config');
const data = require('./questData');
const db = require('./questDb');
const { EMBED_COLOR } = require('../battle/battleDisplay');
const { track } = require('../inactivity');

const BUTTON_PREFIX = 'fquest';
const V2 = 32768; // MessageFlags.IsComponentsV2
const EPHEMERAL = 64;
const TABS = [
    { key: 'daily', label: 'Daily', emoji: '📋' },
    { key: 'weekly', label: 'Weekly', emoji: '📅' },
    { key: 'quests', label: 'Quests', emoji: '📜' }
];

const text = (content) => ({ type: 10, content });
const separator = () => ({ type: 14, divider: true, spacing: 1 });
const button = (customId, { label, emoji, style = 2, disabled = false } = {}) => ({
    type: 2, custom_id: customId, style, disabled, ...(label ? { label } : {}), ...(emoji ? { emoji: { name: emoji } } : {})
});
const row = (...components) => ({ type: 1, components });
const fmt = (n) => Number(n).toLocaleString('en-US');
const unix = (ms) => Math.floor(ms / 1000);

const bar = (current, goal, size = 10) => {
    const filled = Math.max(0, Math.min(size, Math.floor((Math.min(current, goal) / goal) * size)));
    return '▰'.repeat(filled) + '▱'.repeat(size - filled);
};

/** "📦 1 · 🧰 1 · cash 1,000 · shard 100" untuk objek hadiah. */
function rewardText(reward) {
    const parts = [];
    if (reward.lootbox) parts.push(`${emojis.lootbox()} ${fmt(reward.lootbox)}`);
    if (reward.crate) parts.push(`${emojis.crate()} ${fmt(reward.crate)}`);
    if (reward.cash) parts.push(`${cfg.CASH_EMOJI} ${fmt(reward.cash)}`);
    if (reward.shards) parts.push(`${emojis.shard()} ${fmt(reward.shards)}`);
    return parts.join(' · ');
}

const tabsRow = (ownerId, active) => row(...TABS.map((tab) => button(
    `${BUTTON_PREFIX}:${tab.key}:${ownerId}:tab`, { label: tab.label, emoji: tab.emoji, style: tab.key === active ? 1 : 2 }
)));

function checklist(kind, ownerId, ownerName, state, notice) {
    const tab = kind;
    const tasks = db.tasksOf(kind);
    const progress = kind === 'weekly' ? state.weekly : state.daily;
    const claimed = kind === 'weekly' ? state.weeklyClaimed : state.dailyClaimed;
    const status = db.checklistStatus(kind, progress);
    const title = kind === 'weekly' ? 'Weekly' : 'Daily';
    const intro = claimed ? 'Rewards already claimed'
        : status.complete ? 'All tasks done! Claim your rewards below.'
            : kind === 'weekly' ? 'Complete all tasks to earn your weekly reward!' : `Complete ${status.total} tasks to earn your daily reward!`;

    const lines = tasks.map((task) => {
        const current = Math.min(progress[task.key] || 0, task.goal);
        const done = current >= task.goal;
        return `${done ? '✅' : '⬜'} ${task.emoji} **${done ? `~~${task.label}~~` : task.label}** \`${current}/${task.goal}\`\n${bar(current, task.goal)}`;
    });
    const resetAt = kind === 'weekly' ? state.weeklyResetAt : state.dailyResetAt;
    const reward = db.rewardOf(kind);

    const components = [
        tabsRow(ownerId, tab), separator(),
        text(`### 📋 **${ownerName}**'s ${title} Checklist\n${intro}`),
        separator(),
        text(lines.join('\n\n')),
        separator(),
        text(`**${title} Progress** \`${status.done}/${status.total}\`\n${bar(status.done, status.total, 12)}`),
        text(notice || `**Rewards:** ${rewardText(reward)}`),
        text(`⏰ ${title} checklist resets <t:${unix(resetAt)}:R>`),
        separator(),
        row(button(`${BUTTON_PREFIX}:${tab}:${ownerId}:claim`, {
            label: claimed ? 'Claimed!' : `Claim ${kind === 'weekly' ? 'Weekly ' : ''}Rewards`, emoji: '🎁', style: 3,
            disabled: claimed || !status.complete
        }))
    ];
    return components;
}

function questLines(quest) {
    const info = data.QUESTS[quest.name];
    const goal = data.questGoal(quest.name, quest.level);
    const count = quest.name === 'find' ? info.count[quest.level] : goal;
    const reward = rewardText(questPrize(quest));
    const current = Math.min(quest.count, goal);
    return `${info.emoji} **${info.text(count)}**\n${bar(current, goal)} \`${current}/${goal}\`\n**Reward:** ${reward}${quest.done ? '\n✅ **Completed!** Press **Claim**.' : ''}`;
}

const questPrize = (quest) => ({ [quest.prize]: data.questReward(quest.name, quest.level, quest.prize) });

function questLog(ownerId, ownerName, state, notice) {
    const components = [tabsRow(ownerId, 'quests'), separator(), text(`### 📜 **${ownerName}**'s Quest Log\nComplete quests to earn rewards!`), separator()];
    if (!state.quests.length) components.push(text('UwU You finished all of your quests! Come back tomorrow! <3'));
    state.quests.forEach((quest, index) => {
        components.push({
            type: 9,
            components: [text(`**${index + 1}.** ${questLines(quest)}`)],
            accessory: button(`${BUTTON_PREFIX}:quests:${ownerId}:lock:${quest.qid}`, { emoji: quest.locked ? '🔒' : '🔓', style: quest.locked ? 1 : 2 })
        });
    });
    if (notice) components.push(separator(), text(notice));
    const anyDone = state.quests.some((q) => q.done);
    components.push(
        separator(),
        text(`⏰ Next quest: <t:${unix(state.questResetAt)}:R>`),
        separator(),
        row(
            button(`${BUTTON_PREFIX}:quests:${ownerId}:claim`, { label: 'Claim', emoji: '🎁', style: 3, disabled: !anyDone }),
            button(`${BUTTON_PREFIX}:quests:${ownerId}:reroll`, { label: 'Reroll', emoji: '🔁', disabled: !state.canReroll })
        )
    );
    return components;
}

/** Pesan lengkap (Components V2) untuk satu tab. */
async function buildMessage(userId, ownerName, tab = 'daily', { notice, now } = {}) {
    const state = await db.getState(userId, { now });
    const inner = tab === 'quests' ? questLog(userId, ownerName, state, notice)
        : checklist(tab === 'weekly' ? 'weekly' : 'daily', userId, ownerName, state, notice);
    return { components: [{ type: 17, accent_color: EMBED_COLOR, components: inner }], flags: V2, allowedMentions: { parse: [] } };
}

const displayOf = (interaction) => interaction.member?.displayName ?? interaction.user.globalName ?? interaction.user.username;

async function handleButton(interaction) {
    const [, tab, ownerId, action, arg] = interaction.customId.split(':');
    if (interaction.user.id !== ownerId) {
        return interaction.reply({ content: `${cfg.EMOJI.ERROR} | This is not your menu!`, flags: EPHEMERAL });
    }
    let notice;
    if (action === 'claim') {
        if (tab === 'quests') {
            const result = await db.claimQuests(ownerId);
            if (!result.ok) return interaction.reply({ content: `${cfg.EMOJI.ERROR} | You have no finished quests to claim!`, flags: EPHEMERAL });
            notice = `**You claimed ${result.count} quest${result.count === 1 ? '' : 's'}!**\n${rewardText(result.reward)}`;
        } else {
            const kind = tab === 'weekly' ? 'weekly' : 'daily';
            const result = await db.claimChecklist(ownerId, kind);
            if (!result.ok) {
                const why = result.error === 'claimed' ? 'You already claimed these rewards!' : 'Finish every task first!';
                return interaction.reply({ content: `${cfg.EMOJI.ERROR} | ${why}`, flags: EPHEMERAL });
            }
            notice = `**You claimed your rewards!**\n${rewardText(result.reward)}`;
        }
    } else if (action === 'reroll') {
        const result = await db.reroll(ownerId);
        if (!result.ok) {
            const why = result.error === 'used' ? 'You already rerolled today!' : 'There is no quest that can be rerolled!';
            return interaction.reply({ content: `${cfg.EMOJI.ERROR} | ${why}`, flags: EPHEMERAL });
        }
        notice = '🔁 Your quests were rerolled!';
    } else if (action === 'lock') {
        const state = await db.getState(ownerId);
        const quest = state.quests.find((q) => String(q.qid) === String(arg));
        if (quest) await db.setLocked(ownerId, quest.qid, !quest.locked);
    }
    const message = await buildMessage(ownerId, displayOf(interaction), tab, { notice });
    return interaction.update(message);
}

module.exports = { BUTTON_PREFIX, buildMessage, handleButton, rewardText, bar, track };
