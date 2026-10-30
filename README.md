# Fingerpick

One song a day. The one that hit hardest.

Paste a song link (Spotify, Apple Music, YouTube, SoundCloud, Tidal, Deezer),
add a caption of up to 100 characters, and it lands on the Globe of everyone
who follows you. At your midnight it moves into your archive, where each month
becomes a playlist.

- **The Globe** (`/`): a slowly spinning sphere with a tile for each person you
  follow, showing their album cover or a "not yet" tile. Drag to spin, pinch or
  scroll to zoom, tap a song to bring it up close and flip it for the caption.
  The glowing core at the center is your profile: tap it or zoom in to fly in.
- **Your core** (`/u/<username>`): streak, songs shared, usual post time,
  today's song, monthly playlists and the full archive.
- **Demo** (`/demo`): the Globe with made-up friends, no sign-in needed.

## How it's built

- [Next.js](https://nextjs.org) 16 (App Router), hosted on [Vercel](https://vercel.com)
- [Supabase](https://supabase.com) for sign-in (email link) and the Postgres database
- [song.link / Odesli](https://odesli.co) to match a song across platforms and find its artwork
- Playback is always the platform's own embedded player. Nothing is hosted here.

| Path | What's there |
| --- | --- |
| `supabase/migrations/` | The database: tables, security rules |
| `src/app/` | Pages and server actions |
| `src/components/globe/` | The Globe |
| `src/lib/songs.ts` | Song link lookup and embeds |

## Running it

First-time setup (accounts, keys, deploying) is in **[SETUP.md](SETUP.md)**.

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase values
npm run dev                  # http://localhost:3000
```
