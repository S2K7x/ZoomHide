# Zoom Hide: marketing kit

Everything here was produced from the real app (production build) with mocked
Supabase data and royalty-free photos (Unsplash, via picsum.photos).

## Contents

| Folder | What |
|---|---|
| `screenshots/mobile/` | 11 screens at 390×844 @2x (iPhone-size) |
| `screenshots/desktop/` | Same 11 screens at 1440×900 @2x |
| `screenshots/tablet/` | Home, feed, game, leaderboard at 820×1180 @2x |
| `screenshots/12-story-share-image.png` | The 9:16 story image the app generates after a find |
| `video/zoomhide-promo-9x16.mp4` | 28.5 s vertical promo (1080×1920, 30 fps, H.264 + AAC, -14 LUFS) for Reels / TikTok / Shorts / Stories |
| `video/reel-cover.jpg` | Cover frame for the Reel |
| `instagram/` | 7-slide carousel (1080×1350) + `caption.md` (caption, hashtags, alt text) |
| `source/` | Scripts used to make all of the above |

### Screens

01 home · 02 feed · 03 game in progress (hot/cold rings) · 04 found + story
share · 05 out of tries · 06 create (upload) · 07 place your shape ·
08 private hide ready · 09 active hide · 10 leaderboard · 11 private code.

### Video storyboard

| Time | Scene |
|---|---|
| 0–3 s | Hook: "There's a ⭐ hidden in this photo. Can you spot it?" |
| 3–6 s | Zoom into the photo → "Found it! 🎉" |
| 6–9 s | Title: Zoom Hide, hide-and-seek for your photos |
| 9–14 s | 1 · Hide: shape dragged into place on a real photo |
| 14–18 s | 2 · Find: taps with cold → hot → found feedback |
| 18–21 s | 3 · Win: leaderboard + shareable story |
| 21–24 s | Phone or desktop |
| 24–28.5 s | CTA: "Can you find it?" · Play free → zoom-hide.vercel.app |

The soundtrack and sound effects are synthesized from scratch
(`source/studio/music.py`), so there are no licensing issues. To use a
licensed track instead, swap the audio:

```bash
ffmpeg -i video/zoomhide-promo-9x16.mp4 -i your-track.mp3 -map 0:v -map 1:a -c:v copy -c:a aac -shortest promo-with-music.mp4
```

## Regenerating

1. `npm run build && npm start` with `.env.local` pointing to
   `NEXT_PUBLIC_SUPABASE_URL=https://mock.supabase.co` (any anon key).
2. `source/mock/`: `composite.mjs` bakes camouflaged shapes into the photos,
   `harness.cjs` mocks every Supabase call in Playwright, `final.cjs` takes
   the screenshots, `plates.cjs` captures the clean plates used by the video.
3. `source/studio/`: `render.cjs` renders `instagram.html#N` /
   `og.html` / `favicon.html`; `render-video.cjs` renders `video.html`
   frame by frame into ffmpeg; `music.py` writes the soundtrack.
