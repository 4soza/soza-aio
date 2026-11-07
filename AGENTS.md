# Command authorization

- Keep restricted command authorization in a shared server-side helper checking Discord permissions and the configured bot owner, so prefix and slash handlers enforce identical rules without relying on custom server roles.
- Do not restrict slash-command default permissions to Administrator when the bot owner must also be able to invoke the command without that permission; enforce access in the handler.

# Fun economy luck

- Keep pray points and cooldown in the global FunEconomy account with an atomic conditional update, so concurrent commands and bot restarts cannot bypass the cooldown.
- Keep probability math in funeconomy/luckMath.js and use it in both coinflip and slots, so bonuses stay bounded and payout amounts remain unchanged.
- Keep HighLow payout math in funeconomy/highlowMath.js and reuse the blackjack card labels, so displayed cards and payouts stay consistent with the other card games.
- Keep roulette wheel colors and payouts in funeconomy/rouletteMath.js and settle the bet atomically before the spin animation, so a restart mid-animation cannot change the result or balance.
- Load pray through the existing fun economy dispatcher and registration gate; never auto-register players through pray.

# Ticket staff roles

- Keep the merged staff role list in utils/ticketRoles.js so channel access, ticket mentions, and permission checks all use the setup admin role plus the added roles.
- Cap the merged staff role list at the Discord channel permission-overwrite limit so creating a ticket cannot fail.
- Mention staff roles in the ticket opening message instead of offering a separate staff ping button.

# Music prefix

- Keep the music-only `s!` prefix and its command list in utils/musicPrefix.js and check it in events/excessCommands.js before the normal prefix, so music gets the extra prefix without changing how other prefix commands are matched.
- Music panel and lyrics buttons must pass `utils/musicVoiceGuard.js` (clicker in the bot's voice channel; requester/owner gets no bypass) so people outside the call cannot control playback.
