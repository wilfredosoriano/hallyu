import { useEffect, useRef, useState } from 'react';

const TYPE_MS = 38;
const DELETE_MS = 22;
const HOLD_MS = 1500;
const GAP_MS = 400;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Cycles through `phrases`, typing and deleting each in turn, for use as a
 * textarea placeholder. Paused whenever `active` is false (e.g. the field
 * already has real content — no point animating a placeholder no one sees).
 */
export function useTypedPlaceholder(phrases, active = true) {
  const [text, setText] = useState('');
  const timer = useRef(null);

  useEffect(() => {
    if (!active || phrases.length === 0) return undefined;

    if (prefersReducedMotion()) {
      setText(phrases[0]);
      return undefined;
    }

    let phraseIndex = 0;
    let charCount = 0;
    let phase = 'typing';

    const tick = () => {
      const phrase = phrases[phraseIndex];

      if (phase === 'typing') {
        charCount++;
        setText(phrase.slice(0, charCount) + '|');
        if (charCount >= phrase.length) {
          phase = 'holding';
          timer.current = setTimeout(tick, HOLD_MS);
          return;
        }
      } else if (phase === 'holding') {
        phase = 'deleting';
      } else if (phase === 'deleting') {
        charCount--;
        setText(phrase.slice(0, charCount) + (charCount > 0 ? '|' : ''));
        if (charCount <= 0) {
          phase = 'typing';
          phraseIndex = (phraseIndex + 1) % phrases.length;
          timer.current = setTimeout(tick, GAP_MS);
          return;
        }
      }

      timer.current = setTimeout(tick, phase === 'deleting' ? DELETE_MS : TYPE_MS);
    };

    timer.current = setTimeout(tick, TYPE_MS);
    return () => clearTimeout(timer.current);
  }, [active, phrases]);

  return active ? text : '';
}
