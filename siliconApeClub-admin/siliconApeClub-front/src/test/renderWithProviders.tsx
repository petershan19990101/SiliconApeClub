/**
 * renderWithProviders 相关文件，用于承载对应模块的实现。
 */
import React, { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { AppShellProvider } from '../contexts/AppShellContext';
import { ToastProvider } from '../contexts/ToastContext';
import { UserProvider } from '../contexts/UserContext';

export function renderWithProviders(ui: ReactElement) {
  return render(
    <UserProvider>
      <ToastProvider>
        <AppShellProvider>{ui}</AppShellProvider>
      </ToastProvider>
    </UserProvider>
  );
}
