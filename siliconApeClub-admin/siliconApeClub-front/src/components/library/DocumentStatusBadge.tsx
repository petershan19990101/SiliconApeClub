/**
 * 文档状态徽标，统一根据文档状态与任务状态生成展示文案。
 */
import React from 'react';
import { STATUS_META } from '../../constants';
import { Document } from '../../types';
import { cx } from '../../lib/format';

const TONE_STYLES = {
  slate: 'bg-slate-100 text-slate-600',
  blue: 'bg-blue-50 text-blue-700',
  amber: 'bg-amber-50 text-amber-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  rose: 'bg-rose-50 text-rose-700',
};

export function getDocumentDisplayStatus(document: Document) {
  if (document.parseJob.status === 'running' || document.status === 'parsing') {
    return {
      label: '解析中',
      tone: 'amber' as const,
      pulse: true,
      detail: document.parseJob.engine ? `引擎：${document.parseJob.engine}` : '系统正在提取正文内容。',
    };
  }

  if (document.parseJob.status === 'failed') {
    return {
      label: '解析失败',
      tone: 'rose' as const,
      pulse: false,
      detail: document.parseJob.errorMessage ?? '请重新触发解析任务。',
    };
  }

  if (document.ragJob.status === 'running') {
    return {
      label: '知识流水线中',
      tone: 'blue' as const,
      pulse: true,
      detail: '正在生成 LLM Wiki 并同步 RAG 索引。',
    };
  }

  if (document.ragJob.status === 'failed') {
    return {
      label: '知识流水线失败',
      tone: 'rose' as const,
      pulse: false,
      detail: document.ragJob.errorMessage ?? '请重试生成 Wiki 并同步 RAG。',
    };
  }

  if (document.status === 'uploaded' && document.parseJob.status === 'success' && document.ragJob.status === 'idle') {
    return {
      label: '待生成 Wiki',
      tone: 'slate' as const,
      pulse: false,
      detail: document.parseJob.engine
        ? `已使用 ${document.parseJob.engine} 完成解析，等待生成 LLM Wiki。`
        : '解析已完成，等待生成 LLM Wiki。',
    };
  }

  return {
    label: STATUS_META[document.status].label,
    tone: STATUS_META[document.status].tone,
    pulse: false,
    detail: STATUS_META[document.status].description,
  };
}

export function DocumentStatusBadge({ document, compact = false }: { document: Document; compact?: boolean }) {
  const display = getDocumentDisplayStatus(document);

  return (
    <span
      className={cx(
        'inline-flex items-center gap-2 rounded-full font-bold',
        compact ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-xs',
        TONE_STYLES[display.tone]
      )}
      title={display.detail}
    >
      <span className={cx('h-1.5 w-1.5 rounded-full bg-current', display.pulse && 'animate-pulse')} />
      {display.label}
    </span>
  );
}
