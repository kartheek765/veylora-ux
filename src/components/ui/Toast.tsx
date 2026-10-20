import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

type ToastListener = (toast: ToastItem) => void;
const listeners: ToastListener[] = [];

export const toast = {
  success: (message: string, duration = 3000) => {
    listeners.forEach(fn => fn({ id: Math.random().toString(), type: 'success', message, duration }));
  },
  error: (message: string, duration = 4000) => {
    listeners.forEach(fn => fn({ id: Math.random().toString(), type: 'error', message, duration }));
  },
  info: (message: string, duration = 3000) => {
    listeners.forEach(fn => fn({ id: Math.random().toString(), type: 'info', message, duration }));
  },
};

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (newToast: ToastItem) => {
      setToasts(prev => [...prev, newToast]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== newToast.id));
      }, newToast.duration || 3000);
    };

    listeners.push(handler);
    return () => {
      const idx = listeners.indexOf(handler);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-elevated transition-all animate-in slide-in-from-bottom-5 duration-200 ${
            t.type === 'success'
              ? 'bg-surface border-teal/40 text-teal-light'
              : t.type === 'error'
              ? 'bg-surface border-red-500/40 text-red-400'
              : 'bg-surface border-accent/40 text-indigo-300'
          }`}
        >
          <span className="shrink-0 mt-0.5">
            {t.type === 'success' && <CheckCircle2 size={16} className="text-teal" />}
            {t.type === 'error' && <AlertCircle size={16} className="text-red-400" />}
            {t.type === 'info' && <Info size={16} className="text-accent-light" />}
          </span>
          <p className="text-xs font-medium text-text-primary flex-1 leading-relaxed">{t.message}</p>
          <button
            onClick={() => setToasts(prev => prev.filter(item => item.id !== t.id))}
            className="text-text-muted hover:text-text-primary shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};
