// Extra prefix that only works for music commands, e.g. "s!play royalty" or "s!p royalty".
// Music commands only work with this prefix; the normal prefix (".play", ".stop", ...) does not run them.
const MUSIC_PREFIX = 's!';

// typed name -> command file in excesscommands/other
const MUSIC_COMMANDS = {
    play: 'play',
    p: 'play',
    stop: 'stop',
    autoplay: 'autoplay',
    ap: 'autoplay',
    join: 'join',
    leave: 'leave',
    247: '247',
};

// Every music command name (play, p, stop, autoplay, ap, join, leave, 247) only works as "s!..."; the normal "." prefix ignores them.
const MUSIC_PREFIX_ONLY = new Set(Object.keys(MUSIC_COMMANDS));

/**
 * Returns { prefix, typed, commandName, args } when `content` is a music
 * command using the music prefix, otherwise null.
 */
function matchMusicPrefix(content) {
    if (typeof content !== 'string') return null;
    const text = content.trim();
    if (text.slice(0, MUSIC_PREFIX.length).toLowerCase() !== MUSIC_PREFIX) return null;

    const args = text.slice(MUSIC_PREFIX.length).trim().split(/\s+/).filter(Boolean);
    const typed = (args.shift() || '').toLowerCase();
    const commandName = MUSIC_COMMANDS[typed];
    if (!commandName) return null;

    return { prefix: MUSIC_PREFIX, typed, commandName, args };
}

module.exports = { MUSIC_PREFIX, MUSIC_COMMANDS, MUSIC_PREFIX_ONLY, matchMusicPrefix };
