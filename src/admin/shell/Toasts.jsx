import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);
  const timers = useRef(new Set());

  const push = useCallback((message, tone = 'neutral') => {
    const id = nextId.current++;
    setToasts(current => [...current, { id, message, tone }]);
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setToasts(current => current.filter(toast => toast.id !== id));
    }, 4200);
    timers.current.add(timer);
  }, []);

  // Clear pending dismiss timers on unmount so none outlive the provider.
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast-${toast.tone}`}>{toast.message}</div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
