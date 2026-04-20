import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

let toastIdCounter = 0;

/**
 * Simple toast system for action feedback (success / error / info).
 * Rich real-time notifications are handled by the inline LiveActivityBar
 * in MatchesPage — not by floating overlays.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts(t => t.filter(x => x.id !== id));
  }, []);

  const show = useCallback((message, type = 'info', duration = 3500) => {
    const id = ++toastIdCounter;
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => dismiss(id), duration);
  }, [dismiss]);

  const success = useCallback((msg) => show(msg, 'success'), [show]);
  const error   = useCallback((msg) => show(msg, 'error'),   [show]);
  const info    = useCallback((msg) => show(msg, 'info'),    [show]);

  // notify() kept as no-op so existing call sites don't break.
  // Real-time events now appear in the LiveActivityBar instead.
  const notify  = useCallback(() => {}, []);

  return (
    <ToastContext.Provider value={{ show, success, error, info, notify }}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`toast toast-${t.type}`}
            onClick={() => dismiss(t.id)}
          >
            {t.type === 'success' && '✓ '}
            {t.type === 'error'   && '✕ '}
            {t.type === 'info'    && 'ℹ '}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

