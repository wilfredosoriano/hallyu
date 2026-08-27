import { useCallback, useRef, useState } from 'react';

let uid = 0;

/** Fire-and-forget toasts, each auto-dismissing after `ms`. */
export function useToast() {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  const push = useCallback((text, ms = 2200) => {
    const id = ++uid;
    setToasts((prev) => [...prev, { id, text }]);
    timers.current.set(id, setTimeout(() => dismiss(id), ms));
  }, [dismiss]);

  return { toasts, push, dismiss };
}
