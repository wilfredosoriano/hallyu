/** TMDb scores are 0–100 after normalization. Render as five stars plus the exact figure. */
export function starParts(score) {
  if (!score) return null;
  const value = score / 20;
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  return {
    glyphs: '★'.repeat(full) + (half ? '⯪' : '') + '☆'.repeat(5 - full - (half ? 1 : 0)),
    value: value.toFixed(1),
    raw: score,
  };
}

/** TMDb overviews are plain text, but keep this in case a stray tag slips through. */
export function cleanText(input) {
  return String(input ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Platforms that legitimately carry Korean dramas, matched against TMDb's
 * watch-provider names (`media.watchProviders`) so "Watch it here" only
 * badges a service as verified when TMDb actually lists it as available.
 */
const PLATFORMS = [
  { site: 'Netflix', match: /netflix/i, url: (q) => `https://www.netflix.com/search?q=${encodeURIComponent(q)}` },
  { site: 'Viki', match: /\bviki\b/i, url: (q) => `https://www.viki.com/search?q=${encodeURIComponent(q)}` },
  { site: 'Viu', match: /\bviu\b/i, url: (q) => `https://www.viu.com/search/${encodeURIComponent(q)}` },
  { site: 'Kocowa', match: /kocowa/i, url: (q) => `https://www.kocowa.com/search?keyword=${encodeURIComponent(q)}` },
  { site: 'Disney+', match: /disney/i, url: (q) => `https://www.disneyplus.com/search/${encodeURIComponent(q)}` },
  { site: 'Hulu', match: /hulu/i, url: (q) => `https://www.hulu.com/search?q=${encodeURIComponent(q)}` },
  { site: 'Prime Video', match: /amazon|prime video/i, url: (q) => `https://www.amazon.com/s?k=${encodeURIComponent(q)}&i=instant-video` },
  { site: 'Apple TV', match: /apple tv/i, url: (q) => `https://tv.apple.com/search?term=${encodeURIComponent(q)}` },
  { site: 'Tving', match: /tving/i, url: (q) => `https://www.tving.com/search/integration?query=${encodeURIComponent(q)}` },
  { site: 'Sflix', match: /sflix/i, url: (q) => `https://www.xtubeflix.com/?s=${encodeURIComponent(q)}` },
];

/** Verified: services TMDb's watch-provider data confirms carry this title. */
export function legalLinks(media, title) {
  const providers = media.watchProviders || [];
  return PLATFORMS
    .filter((p) => providers.some((name) => p.match.test(name)))
    .map((p) => ({ site: p.site, url: p.url(title) }));
}

/**
 * One-click "search this title" links for the same platforms — the always-
 * available fallback for a service TMDb didn't confirm (its provider data
 * only covers a handful of regions and isn't exhaustive).
 */
export const SEARCH_PLATFORMS = PLATFORMS.map(({ site, url }) => ({ site, url }));

export function searchLinks(title) {
  return SEARCH_PLATFORMS.map((p) => ({ site: p.site, url: p.url(title) }));
}

export function displayTitle(media) {
  return media.title.english || media.title.romaji || 'Untitled';
}
