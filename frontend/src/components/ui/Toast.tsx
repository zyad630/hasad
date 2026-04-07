import React, { createContext, useContext, useState, useCallback } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';
interface Toast { id: number; message: string; type: ToastType; }
interface ToastCtx { showToast: (message: string, type?: ToastType) => void; }

const ToastContext = createContext<ToastCtx>({ showToast: () => {} });
export const useToast = () => useContext(ToastContext);

const icons: Record<ToastType, string> = {
  success: 'fa-circle-check',
  error: 'fa-circle-xmark',
  warning: 'fa-triangle-exclamation',
  info: 'fa-circle-info',
};
const colors: Record<ToastType, string> = {
  success: '#059652',
  error: '#dc2626',
  warning: '#d97706',
  info: '#0284c7',
};

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div style={{
        position: 'fixed', top: '24px', left: '50%', transform: 'translateX(-50%)',
        zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '10px',
        pointerEvents: 'none', minWidth: '320px',
      }}>
        {toasts.map(toast => (
          <div key={toast.id} style={{
            background: 'white',
            borderRight: `5px solid ${colors[toast.type]}`,
            borderRadius: '12px',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
            animation: 'slideDown 0.3s ease',
            pointerEvents: 'auto',
            direction: 'rtl',
          }}>
            <i className={`fa-solid ${icons[toast.type]}`} style={{ color: colors[toast.type], fontSize: '20px', flexShrink: 0 }}></i>
            <span style={{ fontWeight: 700, fontSize: '15px', color: '#1e293b', flex: 1 }}>{toast.message}</span>
          </div>
        ))}
      </div>
      <style>{`@keyframes slideDown { from { opacity:0; transform:translateY(-16px); } to { opacity:1; transform:translateY(0); } }`}</style>
    </ToastContext.Provider>
  );
};
