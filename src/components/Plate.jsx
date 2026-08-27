import { useState } from 'react';
import { starParts, displayTitle, cleanText } from '../lib/format.js';
import { useInView } from '../hooks/useInView.js';

/** One anime as a poster card. `rank` is only passed for ranked AI results. */
export default function Plate({ media, rank, index = 0, caption, saved, onOpen, onSave }) {
  const [loaded, setLoaded] = useState(false);
  const [ref, inView] = useInView();
  const title = displayTitle(media);
  const stars = starParts(media.averageScore);
  const excerpt = !caption && media.description ? cleanText(media.description) : '';

  return (
    <div ref={ref} className={`plate${inView ? ' revealed' : ''}`} style={{ '--i': index % 12 }}>
      <div className="cover-wrap">
        <button
          className="imgbox"
          onClick={() => onOpen(media)}
          aria-label={`Open details for ${title}`}
        >
          <img
            src={media.coverImage.large}
            alt={`Cover art for ${title}`}
            loading="lazy"
            className={loaded ? 'in' : ''}
            onLoad={() => setLoaded(true)}
          />
          {excerpt && (
            <span className="hover-note" aria-hidden="true">
              {excerpt.length > 130 ? `${excerpt.slice(0, 130)}…` : excerpt}
            </span>
          )}
        </button>

        {rank != null && <span className="rank">{String(rank + 1).padStart(2, '0')}</span>}

        <button
          className={`save${saved ? ' on' : ''}`}
          onClick={() => onSave(media)}
          aria-pressed={saved}
          aria-label={`${saved ? 'Remove' : 'Add'} ${title} ${saved ? 'from' : 'to'} want-to-watch`}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M2.5 2h9v10l-4.5-3-4.5 3z" fill={saved ? '#fff' : 'none'} stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div>
        <h4>{title}</h4>
        {media.title.native && <div className="native">{media.title.native}</div>}
      </div>

      <div className="meta">
        {stars ? (
          <>
            <span className="stars" title={`${stars.raw}/100`}>{stars.glyphs}</span>
            <span className="num">{stars.value}</span>
          </>
        ) : (
          <span className="num">unrated</span>
        )}
        <span className="num">
          {media.episodes ? `${media.episodes} ep` : (media.format || '').replace('_', ' ')}
        </span>
        {media.seasonYear && <span className="num">{media.seasonYear}</span>}
      </div>

      {caption && <p className="caption">{caption}</p>}
    </div>
  );
}
