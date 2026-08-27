import { useCallback, useEffect, useState } from 'react';
import Masthead from './components/Masthead.jsx';
import AskPanel from './components/AskPanel.jsx';
import DetailSheet from './components/DetailSheet.jsx';
import ToastStack from './components/Toast.jsx';
import { Grid, Skeletons, Loading, Note, SectionHead, SortControl } from './components/Grid.jsx';
import { fetchGrid, fetchCandidates, toPromptRows } from './lib/anilist.js';
import { useSaved } from './hooks/useSaved.js';
import { useTheme } from './hooks/useTheme.js';
import { useToast } from './hooks/useToast.js';
import { displayTitle } from './lib/format.js';

export default function App() {
  const [genre, setGenre] = useState(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('TRENDING_DESC');
  const [gridItems, setGridItems] = useState([]);
  const [gridState, setGridState] = useState('loading'); // loading | ready | error
  const [gridError, setGridError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null); // { intro, picks, reference, degraded }
  const [asking, setAsking] = useState(false);
  const [askStage, setAskStage] = useState('');
  const [askError, setAskError] = useState('');

  const [open, setOpen] = useState(null);
  const { saved, isSaved, toggle } = useSaved();
  const { theme, toggle: toggleTheme } = useTheme();
  const { toasts, push: pushToast, dismiss: dismissToast } = useToast();

  const onSave = useCallback((media) => {
    const wasSaved = isSaved(media.id);
    toggle(media);
    pushToast(wasSaved ? `Removed “${displayTitle(media)}”` : `Saved “${displayTitle(media)}” to watch`);
  }, [isSaved, toggle, pushToast]);

  /* ── browse ─────────────────────────────────────────────── */
  const load = useCallback(async ({ genre = null, search = '', sort = 'TRENDING_DESC' }) => {
    setGridState('loading');
    setGridError('');
    setPage(1);
    try {
      const { items, hasNextPage } = await fetchGrid({ genre, search: search || null, sort, page: 1 });
      setGridItems(items);
      setHasMore(hasNextPage);
      setGridState('ready');
    } catch (err) {
      setGridError(err.message);
      setGridState('error');
    }
  }, []);

  useEffect(() => {
    load({ genre, search, sort });
  }, [genre, search, sort, load]);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const next = page + 1;
      const { items, hasNextPage } = await fetchGrid({ genre, search: search || null, sort, page: next });
      setGridItems((prev) => [...prev, ...items]);
      setHasMore(hasNextPage);
      setPage(next);
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [genre, search, sort, page]);

  const gridTitle = search
    ? `Results for “${search}”`
    : genre
      ? `Top ${genre}`
      : 'Trending now';

  /* ── ask ────────────────────────────────────────────────── */
  async function ask() {
    const q = question.trim();
    if (!q) return;

    setAsking(true);
    setAskError('');
    setAnswer(null);
    setAskStage('Pulling candidates from AniList');

    try {
      const { reference, pool } = await fetchCandidates(q);

      if (!pool.length) {
        setAskError('No catalog matches for that. Try naming a title you already liked.');
        return;
      }

      setAskStage(`Ranking ${pool.length} candidates`);

      let intro = '';
      let picks = pool.slice(0, 6);
      let degraded = '';

      try {
        const res = await fetch('/api/recommend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: q, pool: toPromptRows(pool) }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);

        const byId = new Map(pool.map((m) => [m.id, m]));
        const resolved = data.picks
          .map((p) => {
            const media = byId.get(p.id);
            return media ? { ...media, _why: p.why } : null;
          })
          .filter(Boolean);

        if (resolved.length) {
          intro = data.intro;
          picks = resolved;
        } else {
          degraded = 'The model returned nothing usable. Showing the closest catalog matches instead.';
        }
      } catch (err) {
        degraded = err.message;
      }

      setAnswer({ intro, picks, reference, degraded, ranked: !degraded });
    } catch (err) {
      setAskError(err.message);
    } finally {
      setAsking(false);
      setAskStage('');
    }
  }

  return (
    <>
      <Masthead
        activeGenre={genre}
        onGenre={(g) => { setGenre(g); setSearch(''); }}
        onSearch={(term) => { setSearch(term); setGenre(null); }}
        onOpenMedia={setOpen}
        theme={theme}
        onToggleTheme={toggleTheme}
        savedCount={saved.length}
      />

      <main className="wrap">
        <AskPanel value={question} onChange={setQuestion} onAsk={ask} busy={asking} />

        {asking && <Loading>{askStage}</Loading>}
        {askError && <Note error>{askError}</Note>}

        {answer && (
          <section>
            <SectionHead
              title={answer.ranked ? 'Recommended for you' : 'Closest in the catalog'}
              count={
                `${answer.picks.length} picks` +
                (answer.reference ? ` · from ${displayTitle(answer.reference)}` : '')
              }
            />
            {answer.intro && <p className="narration">{answer.intro}</p>}
            {answer.degraded && (
              <Note error>
                <strong>Ranked without AI.</strong> {answer.degraded}
              </Note>
            )}
            <Grid
              items={answer.picks}
              ranked={answer.ranked}
              onOpen={setOpen}
              onSave={onSave}
              isSaved={isSaved}
            />
          </section>
        )}

        <SectionHead
          title={gridTitle}
          count={gridState === 'ready' ? `${gridItems.length} titles` : null}
        >
          {!search && (
            <SortControl value={sort} onChange={setSort} />
          )}
        </SectionHead>

        {gridState === 'loading' && <Skeletons />}
        {gridState === 'error' && (
          <Note error>Couldn’t reach AniList — {gridError} Try again in a moment.</Note>
        )}
        {gridState === 'ready' &&
          (gridItems.length ? (
            <>
              <Grid items={gridItems} onOpen={setOpen} onSave={onSave} isSaved={isSaved} />
              {hasMore && (
                <div className="more">
                  <button className="btn ghost" onClick={loadMore} disabled={loadingMore}>
                    {loadingMore ? 'Loading…' : 'Load more'}
                  </button>
                </div>
              )}
            </>
          ) : (
            <Note>Nothing matched that. Try a different spelling or browse a genre.</Note>
          ))}

        {saved.length > 0 && (
          <div id="saved">
            <SectionHead title="Your want-to-watch" count={`${saved.length} saved`} />
            <Grid items={saved} onOpen={setOpen} onSave={onSave} isSaved={isSaved} />
          </div>
        )}
      </main>

      {open && (
        <DetailSheet
          media={open}
          onClose={() => setOpen(null)}
          onOpenRelated={setOpen}
          onSave={onSave}
          isSaved={isSaved}
        />
      )}

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
