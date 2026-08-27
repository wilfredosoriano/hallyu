# Tsugi 次

Anime discovery with AI recommendations grounded in the real AniList catalog.
Browse by genre, search any title, save a want-to-watch list, and ask in plain
language for something to watch next.

No video is hosted or streamed. Every title links out to the platforms that
actually license it.

---

## How the recommendations work

The model does not answer from memory, so it cannot invent a show that does not
exist or attach a made-up rating to a real one.

```
you ask "something similar to Black Clover"
        │
        ▼
1. AniList: resolve "Black Clover" to a real catalog entry
2. AniList: pull its curated recommendation graph + high scorers
   sharing its strongest tags  →  a pool of ~40 real titles
        │
        ▼
3. /api/recommend: Groq receives ONLY that pool as
   "id | title | genres | length | score" rows.
   It ranks 6 and writes one reason each.
        │
        ▼
4. Any id not in the pool is discarded.
   Covers, scores and episode counts come from AniList.
```

If Groq is unreachable, out of quota, or the key is missing, the app still
returns real catalog matches — unranked, with a notice. Nothing hard-fails.

---

## Run it locally

Requires Node 18 or newer.

```bash
npm install
cp .env.example .env      # then paste your Groq key into .env
npm run dev
```

Open http://localhost:5100

Browsing and search work with no key at all — AniList needs none. The key is
only for the ranking step.

`vite dev` does not run serverless functions, so `vite.config.js` mounts the
same handler from `server/rank.js` on the dev server. `npm run dev` therefore
exercises the real code path, and your key stays in `.env`, never in the bundle.

---

## Deploy

### Vercel

```bash
npm i -g vercel
vercel
```

Framework detection picks up Vite automatically. Then add the secret:

**Project → Settings → Environment Variables → `GROQ_API_KEY`**

Redeploy after adding it. `api/recommend.js` becomes the function.

### Cloudflare Pages

Connect the repo in the Cloudflare dashboard, or:

```bash
npm run build
npx wrangler pages deploy dist
```

Build settings:

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node version | 18 or higher |

Then **Settings → Environment variables → `GROQ_API_KEY`** (add it as a secret).
`functions/api/recommend.js` is picked up automatically as the route.

Both adapters are already in the repo. Deploying to one does not require
deleting the other — each platform ignores the file it does not recognize.

---

## Project layout

```
tsugi/
├─ api/recommend.js             Vercel Function adapter
├─ functions/api/recommend.js   Cloudflare Pages Function adapter
├─ server/rank.js               the Groq call — shared by all three runtimes
├─ vite.config.js               includes a dev-time mount of the same handler
└─ src/
   ├─ App.jsx                   state, browse and ask flows
   ├─ index.css                 design tokens + all styles
   ├─ lib/anilist.js            GraphQL client + candidate retrieval
   ├─ lib/format.js             stars, text cleanup, platform filtering
   ├─ hooks/useSaved.js         want-to-watch, persisted to localStorage
   ├─ hooks/useTheme.js         day/night edition toggle, persisted to localStorage
   ├─ hooks/useToast.js         transient save/remove confirmations
   └─ components/
      ├─ Masthead.jsx           logo, search, genre rail, theme toggle
      ├─ AskPanel.jsx           the ask box
      ├─ Plate.jsx              one cover as a printed plate
      ├─ Grid.jsx               grid + sort control + loading/empty/error states
      ├─ DetailSheet.jsx        synopsis, facts, where to watch, more like this
      └─ Toast.jsx              save/remove confirmations
```

The Groq key only ever exists as a server environment variable. It is never
sent to the browser and never appears in the built bundle.

---

## Design notes

A modern, card-based streaming UI — dark-first, poster-heavy, minimal chrome —
rather than a print pastiche. One violet accent carries every action and
active state; gold is reserved exclusively for rating data, so color always
means something. Posters sit in rounded elevated cards with soft shadows
instead of hard borders. Native Japanese titles come from AniList's own
`title.native` field, so they are real content rather than decoration.

Ranked results are numbered because the ranking is genuine information; the
browse grid is not numbered, because its order is not a claim.

**Night/day edition** toggles from the masthead, persisted to `localStorage`,
and defaults to the OS's color-scheme preference on first visit. Dark is the
primary-designed palette; light swaps every token rather than just inverting
grey.

Poster cards lift on hover with a stronger elevation shadow, and reveal a
short synopsis excerpt over the art on pointer devices — gated behind
`(hover: hover)` so it never gets stuck open on a touch tap. A circular
bookmark button overlays each cover rather than sitting in the card's text
flow. Cards enter with a light staggered rise, and the detail sheet closes
the loop with its own AniList-sourced "more like this" row so a session can
wander from title to title without returning to the grid. Saving or removing
a title surfaces a small toast instead of relying on an icon change alone.
All motion respects `prefers-reduced-motion`.

**Mobile** gets its own layout, not just a squeezed desktop one: the grid
drops to two poster columns, the genre rail and search/save controls all
meet a 44px touch target minimum, and the detail sheet becomes a bottom
sheet — full-width, rounded top corners, a drag handle, capped at 92vh with
its own scroll — instead of a centered dialog. `viewport-fit=cover` plus
`env(safe-area-inset-*)` keep the toasts and sheet clear of notches and home
indicators.

---

## Where to take it next

- **AniList OAuth** so watchlists sync to people's real accounts instead of
  localStorage. AniList supports implicit grant, which needs no backend secret.
- **Follow-up questions** — keep the pool in state and let "more like #3, but
  shorter" re-rank the same candidates.
- **Seasonal calendar** using `airingSchedule` for what drops this week.
- **Response caching** on the function (a KV store keyed by question hash) to
  stay inside Groq's free tier under real traffic.

---

## Credits

Data from the [AniList API](https://docs.anilist.co). Inference by
[Groq](https://groq.com). Artwork belongs to its respective licensors and is
shown via AniList's CDN.
