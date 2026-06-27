/**
 * 提示消息上下文，负责创建和管理全局 Toast 提示。
 */
import React, { ReactNode, createContext, useContext, useState } from 'react';
import { ToastViewport } from '../components/ui/ToastViewport';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  tone: 'success' | 'error' | 'info';
}

interface ToastContextValue {
  pushToast: (input: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let toastSequence = 0;

function createToastId() {
  toastSequence += 1;
  return `toast_${toastSequence}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismissToast = (id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  };

  const pushToast = (input: Omit<ToastMessage, 'id'>) => {
    const toast = { id: createToastId(), ...input };
    setToasts((current) => [...current, toast]);
    globalThis.setTimeout(() => dismissToast(toast.id), 4000);
  };

  return (
    <ToastContext.Provider value={{ pushToast, dismissToast }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }

  return context;
}
