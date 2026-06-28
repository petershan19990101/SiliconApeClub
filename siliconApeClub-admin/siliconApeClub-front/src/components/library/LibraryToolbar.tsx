import React from 'react';
import { ChevronRight, FolderPlus, Grid, List, Search, Upload } from 'lucide-react';
import { Folder, User } from '../../types';
import { cx } from '../../lib/format';
import { hasSystemPermission } from '../../lib/systemPermissions';

interface LibraryToolbarProps {
  viewMode: 'list' | 'grid';
  searchQuery: string;
  itemCount: number;
  currentFolderPath: Folder[];
  currentUser: User;
  onSearchChange: (value: string) => void;
  onViewModeChange: (mode: 'list' | 'grid') => void;
  onUpload: () => void;
  onNewFolder: () => void;
  onNavigateRoot: () => void;
  onNavigateFolder: (folderId: string) => void;
}

export function LibraryToolbar({
  viewMode,
  searchQuery,
  itemCount,
  currentFolderPath,
  currentUser,
  onSearchChange,
  onViewModeChange,
  onUpload,
  onNewFolder,
  onNavigateRoot,
  onNavigateFolder,
}: LibraryToolbarProps) {
  const currentFolder = currentFolderPath[currentFolderPath.length - 1];
  const canUpload = hasSystemPermission(currentUser, 'library.upload');
  const canCreateFolder = hasSystemPermission(currentUser, 'library.create_folder');

  return (
    <>
      <div className="px-8 pb-4 pt-8">
        <nav className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-400">
          <button onClick={onNavigateRoot} className="transition hover:text-blue-700">
            产品研发中心
          </button>
          <ChevronRight size={12} />
          <button onClick={onNavigateRoot} className="transition hover:text-blue-700">
            文档管理
          </button>
          {currentFolderPath.map((folder, index) => (
            <React.Fragment key={folder.id}>
              <ChevronRight size={12} />
              <button
                onClick={() => onNavigateFolder(folder.id)}
                className={cx('transition hover:text-blue-700', index === currentFolderPath.length - 1 && 'font-bold text-slate-900')}
              >
                {folder.name}
              </button>
            </React.Fragment>
          ))}
        </nav>
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{currentFolder ? currentFolder.name : '文档管理'}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {currentFolder ? '当前目录下展示子目录与文档，点击面包屑可快速返回上级。' : '统一管理上传、解析校正、审核发布、Wiki 化与 RAG 入库的文档。'}
            </p>
          </div>
          <div className="flex gap-3">
            {canUpload ? (
              <button
                onClick={onUpload}
                className="flex h-10 items-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-bold text-white shadow-lg shadow-blue-700/20 transition hover:brightness-110"
              >
                <Upload size={18} />
                上传文档
              </button>
            ) : null}
            {canCreateFolder ? (
              <button
                onClick={onNewFolder}
                className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
              >
                <FolderPlus size={18} />
                新建文件夹
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-slate-100 px-8 py-3">
        <div className="flex flex-1 items-center gap-4">
          <div className="flex rounded-lg bg-slate-100 p-1">
            <button
              onClick={() => onViewModeChange('list')}
              className={cx(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition',
                viewMode === 'list' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <List size={16} />
              列表
            </button>
            <button
              onClick={() => onViewModeChange('grid')}
              className={cx(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition',
                viewMode === 'grid' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <Grid size={16} />
              网格
            </button>
          </div>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="搜索标题、简介、标签或正文..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-xs transition focus:outline-none focus:ring-2 focus:ring-blue-500/10"
            />
          </div>
        </div>
        <p className="text-xs text-slate-400">共 {itemCount} 项</p>
      </div>
    </>
  );
}
