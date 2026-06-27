/**
 * 全局搜索页面，负责展示接口搜索结果并提供多维筛选能力。
 */
import React, { useEffect, useState } from 'react';
import { ArrowRight, Calendar, Filter, Folder as FolderIcon, Search, User as UserIcon, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Department, DocumentStatus, SearchResult, User } from '../types';
import { useAppShell } from '../contexts/AppShellContext';
import { documentRepository } from '../services';
import { formatDateTime } from '../lib/format';
import { STATUS_META } from '../constants';

type SearchFiltersState = {
  tags?: string[];
  departments?: string[];
  owners?: string[];
  statuses?: string[];
};

export function SearchResults() {
  const { searchQuery, submitSearch, setCurrentView } = useAppShell();
  const [draftQuery, setDraftQuery] = useState(searchQuery);
  const [filters, setFilters] = useState<SearchFiltersState>({});
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setDraftQuery(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    async function bootstrapFilters() {
      const [departmentList, userList, documentList] = await Promise.all([
        documentRepository.getDepartments(),
        documentRepository.listUsers(),
        documentRepository.listDocuments({ limit: 200 }),
      ]);

      setDepartments(departmentList);
      setUsers(userList);
      setAvailableTags(Array.from(new Set(documentList.documents.flatMap((document) => document.tags))).sort());
    }

    void bootstrapFilters();
  }, []);

  useEffect(() => {
    async function runSearch() {
      setIsLoading(true);

      try {
        const response = await documentRepository.search({
          q: searchQuery,
          filters: {
            tags: filters.tags,
            departments: filters.departments,
            owners: filters.owners,
            statuses: filters.statuses as DocumentStatus[] | undefined,
          },
          limit: 50,
        });
        setResults(response.results);
        setTotal(response.total);
      } finally {
        setIsLoading(false);
      }
    }

    void runSearch();
  }, [filters, searchQuery]);

  const toggleListFilter = (key: keyof SearchFiltersState, value: string) => {
    setFilters((current) => {
      const values = (current[key] ?? []) as string[];
      const nextValues = values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

      return {
        ...current,
        [key]: nextValues.length ? nextValues : undefined,
      };
    });
  };

  const clearFilter = (key: keyof SearchFiltersState) => {
    setFilters((current) => ({
      ...current,
      [key]: undefined,
    }));
  };

  const activeFilterCount = Object.values(filters).flatMap((value) => value ?? []).length;

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitSearch(draftQuery);
  };

  const statusOptions = Object.keys(STATUS_META) as DocumentStatus[];

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[28px] border border-slate-100 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-8 py-8">
        <h1 className="mb-6 text-2xl font-bold tracking-tight text-slate-900">全局搜索</h1>

        <div className="flex items-start justify-between gap-6">
          <div className="flex flex-1 items-start gap-4">
            <form onSubmit={handleSearchSubmit} className="flex flex-1 items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  value={draftQuery}
                  onChange={(event) => setDraftQuery(event.target.value)}
                  placeholder="搜索文档标题、描述、标签或正文..."
                  className="w-full rounded-2xl border border-slate-100 bg-slate-50 py-3 pl-10 pr-4 text-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500/10"
                />
              </div>
              <button
                type="submit"
                className="rounded-2xl bg-blue-700 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-700/20 transition hover:brightness-110"
              >
                搜索
              </button>
            </form>

            <div className="relative">
              <button
                onClick={() => setIsFilterOpen((current) => !current)}
                className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold transition ${
                  activeFilterCount
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-slate-100 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Filter size={16} />
                筛选条件
                {activeFilterCount ? (
                  <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] text-white">{activeFilterCount}</span>
                ) : null}
              </button>

              <AnimatePresence>
                {isFilterOpen ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    className="absolute right-0 z-50 mt-3 w-[520px] rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-sm font-bold text-slate-900">高级筛选</h2>
                      <button
                        onClick={() => setFilters({})}
                        className="text-xs font-bold text-slate-400 transition hover:text-blue-600"
                      >
                        清空
                      </button>
                    </div>

                    <div className="space-y-5">
                      <FilterGroup
                        label="标签"
                        options={availableTags.map((tag) => ({ value: tag, label: tag }))}
                        values={filters.tags ?? []}
                        onToggle={(value) => toggleListFilter('tags', value)}
                        onClear={() => clearFilter('tags')}
                      />
                      <FilterGroup
                        label="部门"
                        options={departments.map((department) => ({ value: department.id, label: department.name }))}
                        values={filters.departments ?? []}
                        onToggle={(value) => toggleListFilter('departments', value)}
                        onClear={() => clearFilter('departments')}
                      />
                      <FilterGroup
                        label="上传人"
                        options={users.map((user) => ({ value: user.name, label: user.name }))}
                        values={filters.owners ?? []}
                        onToggle={(value) => toggleListFilter('owners', value)}
                        onClear={() => clearFilter('owners')}
                      />
                      <FilterGroup
                        label="状态"
                        options={statusOptions.map((status) => ({ value: status, label: STATUS_META[status].label }))}
                        values={filters.statuses ?? []}
                        onToggle={(value) => toggleListFilter('statuses', value as DocumentStatus)}
                        onClear={() => clearFilter('statuses')}
                      />
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>

          <p className="whitespace-nowrap pt-3 text-sm text-slate-400">共找到 {total} 条结果</p>
        </div>
      </div>

      <div className="custom-scrollbar flex-1 overflow-auto px-8 py-8">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-700" />
          </div>
        ) : results.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-8 py-12 text-center">
            <p className="text-lg font-bold text-slate-900">没有找到匹配结果</p>
            <p className="mt-2 text-sm text-slate-500">换一个关键词，或者减少筛选条件试试看。</p>
          </div>
        ) : (
          <div className="space-y-5">
            {results.map((result, index) => (
              <motion.div
                key={result.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.04 }}
                className="rounded-3xl border border-slate-100 p-6 transition hover:border-blue-200 hover:shadow-xl hover:shadow-blue-700/5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
                      <Search size={22} />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-lg font-bold text-slate-900">{result.name}</h3>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                          {STATUS_META[result.status].label}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <FolderIcon size={12} />
                          {result.path}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {formatDateTime(result.date)}
                        </span>
                        <span className="flex items-center gap-1">
                          <UserIcon size={12} />
                          {result.user}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="mt-4 truncate text-sm text-slate-500" title={result.snippet}>
                  {result.snippet}
                </p>

                <div className="mt-5 flex flex-wrap gap-4">
                  <button className="flex items-center gap-2 text-sm font-bold text-blue-700 hover:underline">
                    查看详情 <ArrowRight size={16} />
                  </button>
                  <button
                    onClick={() => setCurrentView('library')}
                    className="text-sm font-bold text-slate-400 transition hover:text-slate-600"
                  >
                    打开所在目录
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterGroup({
  label,
  options,
  values,
  onToggle,
  onClear,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  values: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{label}</p>
        {values.length ? (
          <button
            onClick={onClear}
            className="text-[11px] font-bold text-slate-400 transition hover:text-blue-600"
          >
            <X size={12} className="inline-block" /> 清空
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = values.includes(option.value);
          return (
            <button
              key={option.value}
              onClick={() => onToggle(option.value)}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                active
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
