import React from 'react';
import { Search, Sparkles } from 'lucide-react';
import { knowledgeApi } from '../../services/knowledge';
import { useToast } from '../../contexts/ToastContext';

export function RagDebug() {
  const toast = useToast();
  const [query, setQuery] = React.useState('产品经理如何输出 PRD');
  const [actorId, setActorId] = React.useState('1');
  const [positionCode, setPositionCode] = React.useState('product_manager');
  const [result, setResult] = React.useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const run = async () => {
    setIsLoading(true);
    try {
      const data = await knowledgeApi.searchRetrieval({
        query,
        actor: {
          type: 'AI_EMPLOYEE',
          id: actorId,
          departmentId: '1',
          positionCode,
        },
        task: {
          type: 'knowledge_debug',
          projectId: 'mvp',
          riskLevel: 'low',
        },
        policy: {
          topK: 20,
          rerankTopN: 8,
          requireCitation: true,
        },
      });
      setResult(data);
    } catch (error) {
      toast.pushToast({ title: 'RAG 调试失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const results = Array.isArray(result?.results) ? (result?.results as Array<Record<string, unknown>>) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900">RAG 调试台</h1>
        <p className="text-sm text-slate-500">以 AI 员工身份回放检索、权限过滤、rerank 和引用结果。</p>
      </div>

      <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5 md:grid-cols-[1fr_160px_220px_auto]">
        <input value={query} onChange={(event) => setQuery(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none" />
        <input value={actorId} onChange={(event) => setActorId(event.target.value)} placeholder="AI ID" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none" />
        <input value={positionCode} onChange={(event) => setPositionCode(event.target.value)} placeholder="岗位编码" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none" />
        <button onClick={() => void run()} disabled={isLoading} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
          <Search size={16} />
          {isLoading ? '检索中' : '调试'}
        </button>
      </section>

      {result ? (
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-blue-600" />
            <p className="font-bold text-slate-900">Trace: {String(result.traceId)}</p>
          </div>
          <div className="mt-4 space-y-3">
            {results.length === 0 ? <p className="text-sm text-slate-500">无召回结果，请先发布 Wiki 并完成同步。</p> : null}
            {results.map((item) => (
              <div key={String(item.chunkId)} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-900">{String(item.sourceTitle)}</p>
                <p className="mt-1 text-xs text-slate-500">chunk {String(item.chunkId)} · score {String(item.score)} · rerank {String(item.rerankScore)} · {String(item.permissionMatchedBy)}</p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{String(item.content)}</p>
                <p className="mt-2 text-xs text-blue-700">{String(item.whySelected)}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
