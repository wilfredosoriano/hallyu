import { useCallback, useRef, useState } from 'react';

let uid = 0;
const EXIT_MS = 220; // must match the .toast.leaving CSS animation duration

/** Fire-and-forget toasts, each auto-dismissing after `ms`, with an exit animation. */
export function useToast() {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    timers.current.set(id, setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      timers.current.delete(id);
    }, EXIT_MS));
  }, []);

  const push = useCallback((text, ms = 2200) => {
    const id = ++uid;
    setToasts((prev) => [...prev, { id, text, leaving: false }]);
    timers.current.set(id, setTimeout(() => dismiss(id), ms));
  }, [dismiss]);

  return { toasts, push, dismiss };
}
