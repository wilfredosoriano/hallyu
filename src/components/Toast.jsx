export default function ToastStack({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <button key={t.id} className="toast" onClick={() => onDismiss(t.id)}>
          {t.text}
        </button>
      ))}
    </div>
  );
}
