/**
 * TMDb client, scoped to Korean dramas.
 * Free API key from https://www.themoviedb.org/settings/api — no OAuth needed.
 * Docs: https://developer.themoviedb.org/reference/intro/getting-started
 */

const BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';
const API_KEY = import.meta.env.VITE_TMDB_API_KEY;

/**
 * `with_type: 4` is TMDb's "Scripted" TV type — without it, origin+language
 * alone also pulls in Korean variety shows, reality TV, and talk shows
 * (Running Man, Infinite Challenge, SNL Korea, ...), which aren't dramas.
 * `without_genres` catches the stragglers TMDb's crowd-sourced `type` field
 * still mislabels as Scripted (Kids, News, Reality, Talk, Documentary).
 * Neither filter applies to /search, which has no `type`/genre params — a
 * manual search can still surface a non-drama result for an exact title.
 */
const ORIGIN = {
  with_origin_country: 'KR',
  with_original_language: 'ko',
  with_type: 4,
  without_genres: '10762,10763,10764,10767,99',
};

async function tmdb(path, params = {}) {
  const url = new URL(BASE + path);
  url.searchParams.set('api_key', API_KEY);
  url.searchParams.set('language', 'en-US');
  for (const [k, v] of Object.entries(params)) {
    if (v != null) url.searchParams.set(k, v);
  }

  const res = await fetch(url);
  if (res.status === 429) {
    throw new Error('Too many requests right now. Please wait a moment and try again.');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.status_message || `TMDb request failed (${res.status}).`);
  }
  return res.json();
}

const poster = (path, size = 'w500') => (path ? `${IMG}/${size}${path}` : null);
const backdrop = (path, size = 'w1280') => (path ? `${IMG}/${size}${path}` : null);
const isKorean = (r) => (r.origin_country || []).includes('KR') || r.original_language === 'ko';

/** TMDb's fixed TV genre taxonomy — used to label every title, not just the filterable ones. */
const GENRE_NAMES = {
  10759: 'Action & Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime', 99: 'Documentary',
  18: 'Drama', 10751: 'Family', 10762: 'Kids', 9648: 'Mystery', 10763: 'News',
  10764: 'Reality', 10765: 'Sci-Fi & Fantasy', 10766: 'Soap', 10767: 'Talk',
  10768: 'War & Politics', 37: 'Western',
};

/** The subset of that taxonomy worth a filter chip for Korean dramas. */
const GENRE_IDS = {
  Drama: 18, Comedy: 35, 'Action & Adventure': 10759, Mystery: 9648,
  Crime: 80, 'Sci-Fi & Fantasy': 10765, Family: 10751,
};
export const GENRES = Object.keys(GENRE_IDS);

/**
 * TMDb's TV taxonomy has no Romance/Thriller/etc. genre id — those only
 * exist as free-text keywords. Resolved lazily via keyword search (and
 * cached) so `fetchGrid` can pass `with_keywords` instead of `with_genres`,
 * mirroring AniList's tag/genre split.
 */
export const DEMOGRAPHICS = ['Romance', 'Thriller', 'Melodrama', 'Historical'];
const keywordCache = new Map();
async function resolveKeywordId(name) {
  if (keywordCache.has(name)) return keywordCache.get(name);
  const id = await tmdb('/search/keyword', { query: name })
    .then((d) => d.results?.[0]?.id ?? null)
    .catch(() => null);
  keywordCache.set(name, id);
  return id;
}

export const SORTS = [
  { value: 'popularity.desc', label: 'Trending' },
  { value: 'vote_average.desc', label: 'Top rated' },
  { value: 'first_air_date.desc', label: 'Newest' },
  { value: 'first_air_date.asc', label: 'Oldest' },
];
export const DEFAULT_SORT = 'popularity.desc';

function extractProviders(wp) {
  const region = wp?.results?.US || wp?.results?.KR;
  if (!region) return [];
  const names = [...(region.flatrate || []), ...(region.ads || [])].map((p) => p.provider_name);
  return [...new Set(names)];
}

function extractTrailer(videos) {
  const list = videos?.results || [];
  const yt = list.find((v) => v.site === 'YouTube' && v.type === 'Trailer' && v.official)
    || list.find((v) => v.site === 'YouTube' && v.type === 'Trailer')
    || list.find((v) => v.site === 'YouTube');
  return yt ? { site: 'youtube', id: yt.key } : null;
}

/**
 * Normalizes a TMDb TV object (list, search, or full detail shape) into the
 * media shape every component was already built around — so Grid, Plate,
 * Hero and DetailSheet needed no changes beyond the streaming-platform list.
 */
function normalize(show) {
  const genres = Array.isArray(show.genres)
    ? show.genres.map((g) => g.name)
    : (show.genre_ids || []).map((id) => GENRE_NAMES[id]).filter(Boolean);

  return {
    id: show.id,
    title: {
      english: show.name || show.original_name,
      romaji: show.name || show.original_name,
      native: show.original_name && show.original_name !== show.name ? show.original_name : null,
    },
    coverImage: {
      medium: poster(show.poster_path, 'w185'),
      large: poster(show.poster_path, 'w500'),
      extraLarge: poster(show.poster_path, 'w780'),
    },
    bannerImage: backdrop(show.backdrop_path),
    averageScore: show.vote_average ? Math.round(show.vote_average * 10) : null,
    episodes: show.number_of_episodes ?? null,
    seasonYear: show.first_air_date ? Number(show.first_air_date.slice(0, 4)) : null,
    format: null,
    status: show.status ?? null,
    genres,
    siteUrl: `https://www.themoviedb.org/tv/${show.id}`,
    description: show.overview || '',
    studios: { nodes: (show.networks || []).map((n) => ({ name: n.name })) },
    watchProviders: extractProviders(show['watch/providers']),
    trailer: extractTrailer(show.videos),
  };
}

const hasPoster = (r) => Boolean(r.poster_path);

/** Trending, genre/tag-filtered, or search results for the main grid. Paginated. */
export async function fetchGrid({ genre = null, search = null, sort = null, page = 1 } = {}) {
  if (search) {
    const data = await tmdb('/search/tv', { query: search, page });
    return {
      items: (data.results || []).filter((r) => hasPoster(r) && isKorean(r)).map(normalize),
      hasNextPage: page < data.total_pages,
    };
  }

  const params = { ...ORIGIN, page, sort_by: sort || (genre ? 'vote_average.desc' : DEFAULT_SORT) };
  if (params.sort_by === 'vote_average.desc') params['vote_count.gte'] = 20;

  if (genre) {
    if (DEMOGRAPHICS.includes(genre)) {
      const kwId = await resolveKeywordId(genre);
      if (kwId) params.with_keywords = kwId;
    } else if (GENRE_IDS[genre]) {
      params.with_genres = GENRE_IDS[genre];
    }
  }

  const data = await tmdb('/discover/tv', params);
  return {
    items: (data.results || []).filter(hasPoster).map(normalize),
    hasNextPage: page < data.total_pages,
  };
}

/** Fast, lightweight lookup for the live search dropdown. */
export async function quickSearch(term) {
  const data = await tmdb('/search/tv', { query: term });
  return (data.results || []).filter((r) => hasPoster(r) && isKorean(r)).slice(0, 8).map(normalize);
}

/** Full record for a single title, including trailer and watch-provider data. */
export async function fetchById(id) {
  const data = await tmdb(`/tv/${id}`, { append_to_response: 'videos,watch/providers' });
  return normalize(data);
}

/** TMDb's own "if you liked this" graph, for the detail sheet. */
export async function fetchRecommendations(id) {
  const data = await tmdb(`/tv/${id}/recommendations`);
  return (data.results || []).filter((r) => hasPoster(r) && isKorean(r)).slice(0, 8).map(normalize);
}

/** Pull the title a question refers to and confirm it exists in the catalog. */
async function findReference(question) {
  const match = question.match(
    /(?:like|similar to|resembles|reminds me of|in the vein of)\s+([\p{L}\p{N}:'’!.\-\s]{3,60})/iu
  );
  if (!match) return null;

  const guess = match[1]
    .replace(/\b(but|with|and|that|which|though|except|however|only|without)\b[\s\S]*$/i, '')
    .replace(/[.,!?;]+$/, '')
    .trim();
  if (guess.length < 3) return null;

  try {
    const data = await tmdb('/search/tv', { query: guess });
    const hit = (data.results || []).find(isKorean) || data.results?.[0];
    return hit ? normalize(hit) : null;
  } catch {
    return null; // no reference is fine, we fall through to a broad pool
  }
}

/** A pool of high scorers, used whenever a reference-driven pool comes back thin. */
async function broadPool() {
  const pages = await Promise.all([1, 2].map((page) =>
    tmdb('/discover/tv', { ...ORIGIN, sort_by: 'vote_average.desc', 'vote_count.gte': 50, page })
  ));
  return pages.flatMap((d) => d.results || []).filter(hasPoster).map(normalize);
}

/**
 * The grounding step. Builds a pool of real catalog entries BEFORE the model
 * sees anything, from two sources in order of specificity:
 *   1. the reference title's own curated recommendation graph
 *   2. high scorers sharing the reference's strongest keywords
 */
async function poolFromReference(referenceId) {
  const pool = new Map();
  const [recs, keywords] = await Promise.all([
    tmdb(`/tv/${referenceId}/recommendations`).catch(() => ({ results: [] })),
    tmdb(`/tv/${referenceId}/keywords`).catch(() => ({ results: [] })),
  ]);

  for (const r of recs.results || []) {
    if (hasPoster(r) && isKorean(r) && r.id !== referenceId) pool.set(r.id, normalize(r));
  }

  const keywordIds = (keywords.results || []).slice(0, 4).map((k) => k.id);
  if (keywordIds.length) {
    const widened = await tmdb('/discover/tv', {
      ...ORIGIN,
      with_keywords: keywordIds.join('|'),
      sort_by: 'vote_average.desc',
      'vote_count.gte': 20,
    });
    for (const r of widened.results || []) {
      if (hasPoster(r) && r.id !== referenceId) pool.set(r.id, normalize(r));
    }
  }

  return pool;
}

/** Grounds a natural-language question ("similar to X") in the real catalog. */
export async function fetchCandidates(question) {
  const reference = await findReference(question);
  const pool = reference ? await poolFromReference(reference.id) : new Map();

  if (pool.size < 14) {
    for (const m of await broadPool()) pool.set(m.id, m);
  }

  return { reference, pool: [...pool.values()].slice(0, 40) };
}

/**
 * Same grounding step, seeded directly by a known title instead of parsing
 * one out of a question — used to personalize a row off something the user
 * already saved.
 */
export async function fetchCandidatesForMedia(reference) {
  const pool = await poolFromReference(reference.id);

  if (pool.size < 14) {
    for (const m of await broadPool()) pool.set(m.id, m);
  }

  return { reference, pool: [...pool.values()].slice(0, 40) };
}

/** A pool of well-known, backdrop-having titles to draw the homepage hero from. */
export async function fetchFeaturedPool() {
  const data = await tmdb('/discover/tv', { ...ORIGIN, sort_by: 'popularity.desc', page: 1 });
  return (data.results || []).filter((r) => hasPoster(r) && r.backdrop_path).map(normalize);
}

/** Minimal shape sent to the ranking endpoint — no covers, no descriptions. */
export function toPromptRows(pool) {
  return pool.map((m) => ({
    id: m.id,
    title: m.title.english || m.title.romaji,
    genres: m.genres,
    episodes: m.episodes,
    score: m.averageScore,
  }));
}
