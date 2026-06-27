/**
 * 工作台页面组件，负责展示统计卡片、待审核文档和最近活动。
 */
import React, { useEffect, useState } from 'react';
import { CheckSquare, ChevronRight, Clock, Database, FileText, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { ActivityItem, Document, StatCard } from '../types';
import { documentRepository } from '../services';
import { useUser } from '../contexts/UserContext';
import { useAppShell } from '../contexts/AppShellContext';
import { formatDateTime, formatRelativeTime } from '../lib/format';
import { getErrorMessage } from '../lib/errors';

const STAT_ICONS = {
  documents: FileText,
  audit: CheckSquare,
  rag: Database,
  published: ShieldCheck,
};

export function Dashboard() {
  const { currentUser } = useUser();
  const { setCurrentView } = useAppShell();
  const [stats, setStats] = useState<StatCard[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [pendingDocuments, setPendingDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboardData() {
      setIsLoading(true);
      setError(null);

      try {
        const [statsResponse, activityResponse, pendingResponse] = await Promise.all([
          documentRepository.getStats(),
          documentRepository.listActivities({ limit: 6 }),
          documentRepository.listDocuments({ status: 'pending_audit', limit: 6 }),
        ]);

        setStats(statsResponse.stats);
        setActivities(activityResponse.activities);
        setPendingDocuments(pendingResponse.documents);
      } catch (caughtError) {
        setError(getErrorMessage(caughtError, '加载工作台失败'));
      } finally {
        setIsLoading(false);
      }
    }

    void fetchDashboardData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-700" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-100 bg-rose-50 p-8 text-rose-900">
        <h1 className="text-lg font-bold">工作台加载失败</h1>
        <p className="mt-2 text-sm text-rose-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">欢迎回来，{currentUser.name}</h1>
          <p className="mt-1 text-sm text-slate-500">今天重点关注待审核文档、失败任务以及最近的知识库变更。</p>
        </div>
        <button
          onClick={() => setCurrentView('library')}
          className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-700/20 transition hover:brightness-110"
        >
          进入文档库
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat, index) => {
          const Icon = STAT_ICONS[stat.icon];
          return (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm"
            >
              <div className="mb-4 flex items-start justify-between">
                <div className="rounded-2xl bg-slate-50 p-3 text-slate-700">
                  <Icon size={20} />
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wider ${
                    stat.trend === 'up'
                      ? 'bg-emerald-50 text-emerald-700'
                      : stat.trend === 'down'
                        ? 'bg-rose-50 text-rose-700'
                        : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {stat.change}
                </span>
              </div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{stat.title}</p>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-3xl font-bold text-slate-900">{stat.value}</span>
                <span className="pb-1 text-xs text-slate-400">{stat.subtext}</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {currentUser.role === 'admin' ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <CheckSquare size={20} className="text-amber-600" />
              待审核文档
            </h2>
            <button
              onClick={() => setCurrentView('library')}
              className="flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline"
            >
              去审核 <ChevronRight size={14} />
            </button>
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
            {pendingDocuments.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-slate-500">当前没有待审核文档。</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {pendingDocuments.map((document) => (
                  <div key={document.id} className="flex items-center justify-between px-6 py-5 transition hover:bg-slate-50">
                    <div className="flex items-center gap-4">
                      <div className="rounded-2xl bg-amber-50 p-3 text-amber-600">
                        <FileText size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{document.name}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          V{document.currentVersion} · 更新于 {formatDateTime(document.updatedAt)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setCurrentView('library')}
                      className="rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white transition hover:brightness-110"
                    >
                      打开处理
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Clock size={20} className="text-blue-600" />
            最近活动
          </h2>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
          <div className="divide-y divide-slate-100">
            {activities.map((item) => (
              <div key={item.id} className="flex items-start gap-4 px-6 py-5 transition hover:bg-slate-50">
                <div className="rounded-2xl bg-slate-50 p-3 text-slate-600">
                  <Clock size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-sm text-slate-600">
                      <span className="font-bold text-slate-900">{item.user}</span>
                      <span className="mx-1">{item.action}</span>
                      <span className="font-bold text-blue-700">{item.target}</span>
                    </p>
                    <span className="whitespace-nowrap text-[10px] font-medium text-slate-400">
                      {formatRelativeTime(item.createdAt)}
                    </span>
                  </div>
                  {item.tags?.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
