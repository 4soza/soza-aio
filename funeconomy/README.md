# Fun Economy (gaya OwO)

Mata uang: **cash** (saldo global per user, terpisah dari economy lama `.balance`).
Command diketik **tanpa titik**, langsung di chat. Semua pengaturan ada di `funeconomy/config.js`.

| Command | Alias | Fungsi |
|---|---|---|
| `scash` | bal, balance, money, credit, currency | Cek saldo |
| `sdaily` | | Hadiah harian + streak (reset 00:00 WIB) |
| `sgive @user <jumlah\|all>` | send | Kirim cash |
| `scf <jumlah\|all> [h/t]` | coinflip, coin, flip | Coin flip (menang = 2x) |
| `ss <jumlah\|all>` | slots, slot | Slots (lihat tabel di bawah) |
| `sbj <jumlah\|all>` | blackjack | Blackjack dengan tombol Hit/Stand. Ketik ulang `sbj` untuk melanjutkan game |
| `shl <jumlah\|all>` | highlow | HighLow: tebak kartu berikutnya Higher/Lower/Same, lalu Cash Out. Ketik ulang `shl` untuk melanjutkan game |
| `srl <jumlah\|all> <pilihan>` | roulette | Roulette: pilih `red`/`black`/`green`, `odd`/`even`, `low`/`high`, atau satu angka `0-36` |
| `smines <jumlah\|all> [1-8 ranjau]` | | Mines 3×3 dengan tombol petak dan cash out. Default 3 ranjau |
| `slottery [jumlah\|all]` | bet, lotto | Lottery harian, satu pool untuk semua server |
| `sdrop <jumlah\|all>` | | Taruh cash di channel |
| `spickup` | | Ambil semua cash yang di-drop di channel ini |
| `slb [kategori] [global] [1-25]` | leaderboard, rank, ranking | Ranking cash, streak, level, atau total cash per-server |
| `smy [kategori] [global]` | me | Posisi kamu di ranking |

Kategori ranking: `cash` (default), `daily`, `level`, `guild`. Tanpa `global` = server ini.
Contoh: `slb`, `slb global`, `slb daily 5`, `slb level g`, `slb guild`, `smy`, `smy cash global`.

- Cooldown **15 detik** per game untuk `ss`, `scf`, `sbj`, `shl`, `srl`, `smines` (per user). Ubah di `COOLDOWNS` pada `config.js` (0 = mati).
- Taruhan minimal **1**, maksimal **250,000**. `all` = `min(saldo, 250,000)`.
- Slots (odds OwO, RTP 95%): 🍆🍆🍆 x1 (20%), ❤️❤️❤️ x2 (20%), 🍒🍒🍒 x3 (5%), cash x3 x4 (2.5%), ⭕🇼⭕ x10 (1%).
- Blackjack: menang 2x, seri = taruhan kembali, dealer berhenti di 17, tepat 21 otomatis stand.
- HighLow: kartu tampil seperti blackjack (`7♦`), As terendah dan K tertinggi. Higher/Lower dibayar 13 ÷ jumlah kartu yang menang × 94% (kartu 7 = 2.03x, kartu 4: Higher 1.35x / Lower 4.07x), Same selalu 10x. Hasil berlipat setiap tebakan benar; salah tebak = taruhan hilang. Cash Out aktif setelah satu tebakan benar. Ubah di `HIGHLOW` pada `config.js`.
- Roulette (roda Eropa 0-36): **0 = hijau**; **merah** = 1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36; **hitam** = 2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35. Merah/hitam, ganjil/genap (`odd`/`even`), `low` (1-18) dan `high` (19-36) dibayar 2x; kalau bola jatuh di 0 semua taruhan itu kalah. Hijau atau satu angka dibayar 36x. Bisa juga pakai kata `merah`, `hitam`, `hijau`, `ganjil`, `genap`. Contoh: `srl 5000 black`, `srl all red`, `srl 1000 17`. Ubah di `ROULETTE` pada `config.js`.
- Mines: pilih 1–8 ranjau (default 3), buka petak dengan tombol, lalu cash out sebelum kena ranjau. Semakin banyak ranjau, multiplier semakin besar; dengan RTP 94%, multiplier pada pilihan aman pertama untuk 4–8 ranjau adalah 1.69x, 2.12x, 2.82x, 4.23x, dan 8.46x. Delapan ranjau menyisakan satu petak aman. Game aktif tersimpan agar bisa dilanjutkan dengan mengetik ulang `smines`.
- Lottery: peluang menang = taruhanmu / total pool, maksimal 250,000 per lottery per user. Undian otomatis setiap pergantian hari; pemenang menerima seluruh pool dan DM.
- `ss` tanpa angka diabaikan (supaya "ss" = screenshot di chat tidak memicu slots). Ubah lewat `SLOTS_REQUIRE_AMOUNT`.
- Ganti emoji (mis. emoji custom server) di `CASH_EMOJI`, `COIN`, `SLOT_EMOJI`, dan `SLOT_SPINNING`.
- Ranking per-server memakai server tempat user memakai command, lalu mengisi akun lama dari daftar anggota saat ranking server dibuka.

## Level

Chat memberi XP untuk akun terdaftar; kenaikan level memberi cash.

| Command | Alias | Fungsi |
|---|---|---|
| `slevel [@user]` | lvl, xp | Kartu level ala OwO: avatar, nama, server, LVL, Rank global, XP, dan progress bar |
| `senable <all\|command>` | - | Aktifkan command di channel ini (izin Manage Channel) |
| `sdisable <all\|command>` | - | Matikan command di channel ini; `sdisable all` mematikan semuanya. Pesan "that command is disabled on this channel!" hilang setelah 2 detik |
| `slevelup` | lvlup | Info pesan level up; matikan per channel dengan `sdisable levelup` |

- `/levelcard upload` menyimpan gambar yang Anda pilih dari galeri perangkat melalui lampiran Discord untuk kartu level `slevel` dan notifikasi saat Anda naik level.
- `/levelcard reset` mengembalikan gambar kartu level dan notifikasi level-up ke bawaan.
- Chat memberi 10–15 XP per menit, maksimal 3.000 XP chat per hari.
- Bonus 500 XP untuk pesan pertama harian dan 100 XP saat `sdaily` berhasil, di luar batas chat.
- Pesan bot, DM, command bot, pesan kurang dari 3 karakter, serta pesan terakhir yang sama tidak mendapat XP.
- Hadiah level adalah 5.000 cash dikali nomor level. Hadiah masuk saldo meski pengumuman level up dimatikan.
- Level up diumumkan dengan kartu gambar "LEVEL UP!" (`LEVELING.LEVELUP_CARD`). Tanpa izin Attach Files, bot memakai teks biasa.
- Rumus XP dapat diubah pada `LEVELING.FORMULA` di `config.js`; `LEVELING.ENABLED: false` mematikan fitur.
- `slb level` dan `smy level` memakai XP Fun Economy.

## Registrasi akun

Semua command economy (prefix `s`, slash `/economy`, dan `/fun slots|coinflip|lottery|blackjack`) membutuhkan akun aktif.
Pengguna yang belum terdaftar melihat kartu Welcome dengan tombol Register; setelah ditekan, akun aktif dan menerima bonus
**250.000 cash**. Command lain di bot tidak terpengaruh.

- Hanya pemilik kartu yang bisa menekan tombolnya. Bonus diberikan tepat sekali per pengguna.
- Untuk prefix, kartu muncul maksimal sekali per `PROMPT_COOLDOWN_MS` per pengguna. `ss` tanpa angka tidak memicu kartu.
- `sgive` / `/economy give` ke pengguna yang belum terdaftar ditolak.
- Pemain lama yang sudah punya saldo atau pernah `daily` otomatis dianggap terdaftar tanpa bonus. Migrasi ini berjalan
  sekali saat command economy pertama dipakai; matikan lewat `GRANDFATHER_EXISTING: false`.
- Pengaturan tersedia di `REGISTRATION` pada `config.js`: `ENABLED`, `BONUS`, `GRANDFATHER_EXISTING`, `PROMPT_COOLDOWN_MS`.

## Struktur
- `events/funEconomy.js` - listener `messageCreate` (dimuat otomatis oleh `handlers/events.js`)
- `funeconomy/index.js` - dispatcher prefix `s` + loader command
- `funeconomy/commands/*.js` - satu file per command (tambah file baru = command baru)
- `funeconomy/leveling.js`, `funeconomy/levelUp.js`, dan `models/funeconomy/level.js` - rumus, penghargaan XP, dan data level
- `events/funEconomyLevel.js` - listener XP chat
- `funeconomy/register.js` - kartu & tombol Register, `models/funeconomy/registration.js` - logika akun
- `events/funEconomyInteraction.js` - tombol blackjack, HighLow, Mines & Register; `events/funEconomyReady.js` - jadwal lottery
- `models/funeconomy/` - schema & operasi database (taruhan diproses atomik)

## Slash commands

Perintah slash memakai saldo cash global yang sama:

- `/economy balance [user]`
- `/economy daily`
- `/economy slots bet`
- `/economy coinflip bet side`
- `/economy give user amount`
- `/economy leaderboard`
- `/fun slots bet` dan `/fun coinflip bet side` juga memakai saldo cash baru.

Perintah lama `/economy work`, `beg`, `deposit`, `withdraw`, serta `/fun lottery` dan
`blackjack` tidak lagi didaftarkan. Jalankan ulang bot agar Discord memperbarui daftar slash command.

## Perintah pembuat bot

`/addcash user amount` menambahkan hingga 1.000.000.000 cash ke pengguna. Isi `DISCORD_USER_ID`
dengan Discord user ID pembuat bot. Isi juga `DISCORD_GUILD_ID` di Railway dengan ID server tempat
command tersedia. Command hanya didaftarkan di server itu, dibatasi ke admin oleh Discord, lalu bot
memeriksa ID pemilik sebelum menambah saldo. Untuk menyembunyikannya dari admin lain juga, batasi
`/addcash` ke pengguna pembuat bot di **Server Settings → Integrations → bot → Commands**.

`/resetcash user_id` mengembalikan cash pengguna (berdasarkan Discord user ID) menjadi 0. Aturan akses
dan server-nya sama seperti `/addcash` (hanya `DISCORD_USER_ID`, hanya di `DISCORD_GUILD_ID`).

Pemilik bot (`DISCORD_USER_ID`) bermain game tanpa memakai saldo: taruhan tidak dipotong dan
kemenangan tidak ditambahkan, jadi saldo aslinya tidak berubah. Berlaku untuk coinflip, slots,
roulette, blackjack, highlow, mines, dan lottery. `sgive`, `sdrop`, `sdaily`, dan `/addcash`
tetap memakai saldo asli.

Command slash lainnya tetap didaftarkan secara global. Pemisahan ini menjaga jumlah global di bawah
batas 100 command Discord.


## Hunt, zoo, dan battle (gaya OwO)

Berdasarkan OwO Bot oleh Christopher Thai (CC BY-NC-SA 4.0). Semua hewan memakai emoji Unicode.

- Hunt: `shunt` (`sh`) memakai 5 cash. `szoo`, `ssell`, `ssacrifice` (`ssac`), `slootbox`, `sgem`, `sautohunt`, `supgrade`, `sdex`.
- Battle: `sbattle` (`sb`) melawan tim acak, atau `sbattle @user` untuk teman. `steam`, `steams`, `spets`, `srename`, `sbattlesetting`.
- Senjata: `scrate` (crate dari battle), `sweapon` (`sw`), `sweaponshard` (`sws`).
- Hewan di tim aktif ikut mendapat XP saat hunt.
- Tidak dibuat: sistem patreon, event, guild boss, gambar battle (diganti teks/embed).

### Shop, inventory, dan marriage

- `sshop` (ring dan toko senjata), `sshop weapon`, `sbuy <id>` (ring 1-7 pakai cash, crate/senjata pakai weapon shard), `sinv`, `sequip <id>`.
- `ssell 1` sampai `ssell 7` menjual ring (75% dari harga).
- `smarry @user <ring id>`, `sam` (`sacceptmarriage`), `sdm` (`sdeclinemarriage`), `sdivorce`.
- Wallpaper tidak dibuat.
