# Hallyu 류

Korean drama discovery with AI recommendations grounded in the real TMDb
catalog. Browse by genre, search any title, save a want-to-watch list, and
ask in plain language for something to watch next.

No video is hosted or streamed. Every title links out to the platforms that
actually license it.

---

## How the recommendations work

The model does not answer from memory, so it cannot invent a show that does
not exist or attach a made-up rating to a real one.

```
you ask "something similar to Crash Landing on You"
        │
        ▼
1. TMDb: resolve "Crash Landing on You" to a real catalog entry
2. TMDb: pull its recommendation graph + high scorers sharing
   its strongest keywords  →  a pool of ~40 real titles
        │
        ▼
3. /api/recommend: Groq receives ONLY that pool as
   "id | title | genres | length | score" rows.
   It ranks 6 and writes one reason each.
        │
        ▼
4. Any id not in the pool is discarded.
   Covers, scores and episode counts come from TMDb.
```

If Groq is unreachable, out of quota, or the key is missing, the app still
returns real catalog matches — unranked, with a notice. Nothing hard-fails.

---

## Run it locally

Requires Node 18 or newer.

```bash
npm install
cp .env.example .env      # then paste your TMDb + Groq keys into .env
npm run dev
```

Open http://localhost:5100

Browsing and search need a free TMDb key (https://www.themoviedb.org/settings/api).
The Groq key is only for the ranking step.

`vite dev` does not run serverless functions, so `vite.config.js` mounts the
same handler from `server/rank.js` on the dev server. `npm run dev` therefore
exercises the real code path, and your keys stay in `.env`, never committed.

---

## Deploy

### Vercel

```bash
npm i -g vercel
vercel
```

Framework detection picks up Vite automatically. Then add the secrets:

**Project → Settings → Environment Variables → `VITE_TMDB_API_KEY`, `TMDB_API_KEY`, `GROQ_API_KEY`**

Redeploy after adding them. `api/recommend.js` and `api/og.js` become functions.

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

Then **Settings → Environment variables → `VITE_TMDB_API_KEY`, `TMDB_API_KEY`, `GROQ_API_KEY`**
(add them as secrets). `functions/api/recommend.js` and `functions/api/og.js`
are picked up automatically as routes.

Both adapters are already in the repo. Deploying to one does not require
deleting the other — each platform ignores the file it does not recognize.

---

## Project layout

```
hallyu/
├─ api/recommend.js             Vercel Function adapter
├─ functions/api/recommend.js   Cloudflare Pages Function adapter
├─ server/rank.js               the Groq call — shared by all three runtimes
├─ vite.config.js               includes a dev-time mount of the same handler
└─ src/
   ├─ App.jsx                   state, browse and ask flows
   ├─ index.css                 design tokens + all styles
   ├─ lib/tmdb.js                TMDb client + candidate retrieval
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
sent to the browser and never appears in the built bundle. The TMDb key is
bundled client-side (as `VITE_TMDB_API_KEY`) since browsing and search call
TMDb straight from the browser — the same pattern most personal TMDb-backed
apps use for a free, low-stakes API key.

---

## Design notes

A modern, card-based streaming UI — dark-first, poster-heavy, minimal chrome —
rather than a print pastiche. One violet accent carries every action and
active state; gold is reserved exclusively for rating data, so color always
means something. Posters sit in rounded elevated cards with soft shadows
instead of hard borders. Native Korean titles come from TMDb's own
`original_name` field, so they are real content rather than decoration.

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
the loop with its own TMDb-sourced "more like this" row so a session can
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

## Where TMDb's data shapes what's possible

- TMDb's TV genre taxonomy has no Romance/Thriller/Melodrama entries — those
  are only searchable as free-text keywords, so the extra genre-rail chips
  resolve to a keyword id at request time instead of a fixed genre id.
- Ongoing dramas' seasons live under one show id on TMDb rather than a
  separate entry per season, so there is no prequel/sequel relation graph
  like anime trackers have — the detail sheet's recommendations row is the
  closest equivalent.
- List/search endpoints don't return an episode count — only the full detail
  call does — so grid cards show year and rating only, with episode count
  appearing once you open a title.

## Where to take it next

- **TMDb OAuth (v4 session)** so watchlists sync to people's real accounts
  instead of localStorage.
- **Follow-up questions** — keep the pool in state and let "more like #3, but
  shorter" re-rank the same candidates.
- **Airing calendar** using TMDb's `on_the_air` endpoint for what drops this
  week.
- **Response caching** on the function (a KV store keyed by question hash) to
  stay inside Groq's free tier under real traffic.

---

## Credits

Data from [TMDb](https://www.themoviedb.org/) (this product uses the TMDb API
but is not endorsed or certified by TMDb). Inference by
[Groq](https://groq.com). Artwork belongs to its respective licensors and is
shown via TMDb's CDN.
