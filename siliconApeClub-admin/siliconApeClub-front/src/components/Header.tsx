import React, { FormEvent, useEffect, useRef, useState } from 'react';
import { Bell, ChevronDown, HelpCircle, KeyRound, LayoutGrid, LogOut, Menu, Search } from 'lucide-react';
import { ROLE_LABELS } from '../constants';
import { useAppShell } from '../contexts/AppShellContext';
import { useUser } from '../contexts/UserContext';
import { cx } from '../lib/format';
import { ChangePasswordModal } from './ChangePasswordModal';

export function Header() {
  const { currentUser, logout } = useUser();
  const { searchQuery, setSearchQuery, submitSearch } = useAppShell();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitSearch();
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  if (!currentUser) {
    return null;
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-100 bg-white px-8">
      <div className="flex flex-1 items-center gap-6">
        <button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden">
          <Menu size={20} />
        </button>
        <form onSubmit={handleSubmit} className="flex w-full max-w-2xl items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="搜索文档标题、标签、正文内容..."
              className="w-full rounded-xl border border-slate-100 bg-slate-50 py-2 pl-10 pr-4 text-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500/10"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:brightness-110"
          >
            搜索
          </button>
        </form>
      </div>

      <div className="flex items-center gap-4">
        <span className="hidden rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-600 md:inline-flex">
          {ROLE_LABELS[currentUser.role]}
        </span>

        <div className="mr-2 flex items-center gap-1 border-r border-slate-100 pr-4">
          <button type="button" className="relative rounded-xl p-2 text-slate-500 transition hover:bg-slate-100">
            <Bell size={20} />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-rose-500" />
          </button>
          <button type="button" className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100">
            <HelpCircle size={20} />
          </button>
          <button type="button" className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100">
            <LayoutGrid size={20} />
          </button>
        </div>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsUserMenuOpen((current) => !current)}
            className="group flex items-center gap-3 rounded-xl py-1 pl-2 pr-2 transition hover:bg-slate-50"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-blue-200 bg-blue-100 text-xs font-bold text-blue-700">
              {currentUser.avatar ?? currentUser.name.charAt(0)}
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-slate-700">{currentUser.name}</p>
              <p className="text-[10px] font-medium text-slate-400">{ROLE_LABELS[currentUser.role]}</p>
            </div>
            <ChevronDown
              size={16}
              className={cx('text-slate-400 transition-transform', isUserMenuOpen && 'rotate-180')}
            />
          </button>

          {isUserMenuOpen ? (
            <div className="absolute right-0 z-30 mt-3 w-56 overflow-hidden rounded-2xl border border-slate-100 bg-white py-2 shadow-2xl">
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="text-sm font-bold text-slate-900">{currentUser.name}</p>
                <p className="mt-1 text-xs text-slate-500">{currentUser.departmentName ?? currentUser.departmentId}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsUserMenuOpen(false);
                  setIsChangePasswordOpen(true);
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                <KeyRound size={16} className="text-amber-500" />
                修改密码
              </button>
              <button
                type="button"
                onClick={async () => {
                  setIsUserMenuOpen(false);
                  await logout();
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-sm font-bold text-rose-500 transition hover:bg-rose-50"
              >
                <LogOut size={16} />
                退出登录
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {isChangePasswordOpen ? (
        <ChangePasswordModal
          onClose={() => setIsChangePasswordOpen(false)}
          onSuccess={async () => {
            await logout();
          }}
        />
      ) : null}
    </header>
  );
}
