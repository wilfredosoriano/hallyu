import { useEffect, useRef, useState } from 'react';

/**
 * True once the element has scrolled into view — fires once, then stops
 * watching. Falls back to revealing after `maxWait` regardless, so content
 * can never get stuck invisible if IntersectionObserver misbehaves.
 */
export function useInView({ rootMargin = '0px 0px -60px 0px', maxWait = 2500 } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (!('IntersectionObserver' in window)) {
      setInView(true);
      return undefined;
    }

    const reveal = () => setInView(true);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          reveal();
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(el);
    const fallback = setTimeout(reveal, maxWait);

    return () => {
      observer.disconnect();
      clearTimeout(fallback);
    };
  }, [rootMargin, maxWait]);

  return [ref, inView];
}
