import { useEffect } from 'react';

/**
 * Fixed top-of-screen toast for account success / error messages.
 */
export function Toast({ message, error, toastKey = 0, onDismiss }) {
  const text = error || message;
  const isError = !!error;

  useEffect(() => {
    if (!text || !onDismiss) return undefined;
    const timer = setTimeout(onDismiss, 3500);
    return () => clearTimeout(timer);
  }, [text, toastKey, onDismiss]);

  if (!text) return null;

  return (
    <div className="toast-viewport" role="status" aria-live="polite">
      <div key={toastKey} className={`toast ${isError ? 'toast-error' : 'toast-success'}`}>
        <span className="toast-text">{text}</span>
        <button type="button" className="toast-close" onClick={onDismiss} aria-label="Dismiss">
          ×
        </button>
      </div>
    </div>
  );
}

export default Toast;
