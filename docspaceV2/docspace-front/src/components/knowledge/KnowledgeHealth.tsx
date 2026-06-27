import React from 'react';
import { Activity, FileText, PauseCircle, PlayCircle } from 'lucide-react';
import { knowledgeApi } from '../../services/knowledge';
import { HealthIssue, HealthReport } from '../../types';
import { useToast } from '../../contexts/ToastContext';

export function KnowledgeHealth() {
  const toast = useToast();
  const [issues, setIssues] = React.useState<HealthIssue[]>([]);
  const [reports, setReports] = React.useState<HealthReport[]>([]);
  const [windowState, setWindowState] = React.useState<Record<string, unknown> | null>(null);

  const load = React.useCallback(async () => {
    try {
      const [nextIssues, nextReports, nextWindow] = await Promise.all([
        knowledgeApi.listHealthIssues(),
        knowledgeApi.listHealthReports(),
        knowledgeApi.getMaintenanceWindow(),
      ]);
      setIssues(nextIssues);
      setReports(nextReports);
      setWindowState(nextWindow);
    } catch (error) {
      toast.pushToast({ title: '知识健康数据加载失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
    }
  }, [toast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const generateReport = async () => {
    try {
      await knowledgeApi.generateHealthReport();
      toast.pushToast({ title: '知识健康报告已生成', tone: 'success' });
      await load();
    } catch (error) {
      toast.pushToast({ title: '生成报告失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
    }
  };

  const toggleWindow = async () => {
    try {
      if (windowState?.status === 'MAINTENANCE_WINDOW') {
        await knowledgeApi.endMaintenanceWindow();
        toast.pushToast({ title: '已退出知识静默窗口', tone: 'success' });
      } else {
        await knowledgeApi.startMaintenanceWindow('每日知识健康巡检');
        toast.pushToast({ title: '已进入知识静默窗口', tone: 'success' });
      }
      await load();
    } catch (error) {
      toast.pushToast({ title: '维护窗口切换失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
    }
  };

  const latestReport = reports[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">知识健康</h1>
          <p className="text-sm text-slate-500">巡检冲突、过期、同步异常和低质量知识，并输出日报。</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void toggleWindow()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700">
            {windowState?.status === 'MAINTENANCE_WINDOW' ? <PlayCircle size={16} /> : <PauseCircle size={16} />}
            {windowState?.status === 'MAINTENANCE_WINDOW' ? '结束静默窗口' : '开始静默窗口'}
          </button>
          <button onClick={() => void generateReport()} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white">
            <FileText size={16} />
            生成日报
          </button>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-xs font-bold uppercase text-slate-400">当前窗口</p>
          <p className="mt-2 text-xl font-black text-slate-900">{String(windowState?.status ?? 'NORMAL')}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-xs font-bold uppercase text-slate-400">开放问题</p>
          <p className="mt-2 text-xl font-black text-slate-900">{issues.filter((item) => item.status === 'open').length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-xs font-bold uppercase text-slate-400">最新健康分</p>
          <p className="mt-2 text-xl font-black text-slate-900">{latestReport?.healthScore ?? '-'}</p>
        </div>
      </section>

      {latestReport ? (
        <section className="rounded-lg border border-blue-100 bg-blue-50 p-5">
          <div className="flex items-center gap-2">
            <Activity size={18} className="text-blue-700" />
            <p className="font-bold text-blue-950">最新健康日报</p>
          </div>
          <p className="mt-2 text-sm text-blue-900">{latestReport.summary}</p>
        </section>
      ) : null}

      <section className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {issues.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">暂无健康问题</div> : null}
        {issues.map((issue) => (
          <div key={issue.id} className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-900">{issue.title}</p>
              <span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{issue.severity}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{issue.issueType} · {issue.status}</p>
            {issue.suggestedAction ? <p className="mt-2 text-sm text-slate-600">{issue.suggestedAction}</p> : null}
          </div>
        ))}
      </section>
    </div>
  );
}
