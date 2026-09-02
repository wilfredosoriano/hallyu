/**
 * Server-rendered Open Graph/Twitter Card HTML for a single shared drama
 * link — so pasting a Hallyu URL into Discord/Slack/X/etc. shows its title
 * and poster art instead of a blank card.
 *
 * A social-media crawler fetches raw HTML and reads <meta> tags; it never
 * runs the SPA's JS, so a client-side-only title/meta update (the usual SPA
 * approach) is invisible to it. This exists purely for those crawlers — real
 * visitors always get the React app. See vercel.json for the request-routing
 * side of that (only known bot user agents get rewritten here).
 *
 * Imported by:
 *   api/og.js            → Vercel Function (Node)
 *   functions/api/og.js  → Cloudflare Pages Function (Workers)
 */

import { cleanText, displayTitle } from '../src/lib/format.js';

const SITE_NAME = 'Hallyu';
const SITE_DESCRIPTION = 'Browse Korean dramas by genre and ask for recommendations grounded in the real TMDb catalog.';

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

async function fetchMedia(id, apiKey) {
  if (!apiKey) return null;
  const url = new URL(`https://api.themoviedb.org/3/tv/${id}`);
  url.searchParams.set('api_key', apiKey);
  const res = await fetch(url);
  if (!res.ok) return null;
  const show = await res.json();
  return {
    title: { english: show.name, romaji: show.original_name },
    description: show.overview,
    coverImage: {
      extraLarge: show.poster_path ? `https://image.tmdb.org/t/p/w780${show.poster_path}` : null,
      large: show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : null,
    },
  };
}

export async function buildOgHtml({ id, siteUrl, apiKey }) {
  const numId = Number(id);
  const media = Number.isInteger(numId) && numId > 0 ? await fetchMedia(numId, apiKey).catch(() => null) : null;

  const pageUrl = media ? `${siteUrl}/?id=${numId}` : siteUrl;
  const title = media ? displayTitle(media) : `${SITE_NAME} — what K-drama to watch next`;
  const description = media
    ? (cleanText(media.description).slice(0, 200) || SITE_DESCRIPTION)
    : SITE_DESCRIPTION;
  const image = media?.coverImage?.extraLarge || media?.coverImage?.large;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(title)}${media ? ` — ${SITE_NAME}` : ''}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
${image ? `<meta property="og:image" content="${esc(image)}">` : ''}
<meta property="og:url" content="${esc(pageUrl)}">
<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
${image ? `<meta name="twitter:image" content="${esc(image)}">` : ''}
<meta http-equiv="refresh" content="0; url=${esc(pageUrl)}">
</head>
<body>
<a href="${esc(pageUrl)}">${esc(title)}</a>
</body>
</html>`;
}
