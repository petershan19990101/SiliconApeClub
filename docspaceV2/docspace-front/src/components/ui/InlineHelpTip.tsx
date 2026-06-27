import React, { useId } from 'react';
import { CircleHelp } from 'lucide-react';

export interface InlineHelpTipProps {
  content: string;
  className?: string;
}

export function InlineHelpTip({ content, className }: InlineHelpTipProps) {
  const tooltipId = useId();
  const wrapperClassName = ['group/help relative inline-flex shrink-0 text-slate-400', className].filter(Boolean).join(' ');

  return (
    <span className={wrapperClassName}>
      <button
        type="button"
        aria-label="查看说明"
        aria-describedby={tooltipId}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full transition hover:bg-slate-100 hover:opacity-100 focus-visible:bg-slate-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
      >
        <CircleHelp size={14} />
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-[80] mt-2 w-max max-w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs leading-5 text-slate-600 shadow-xl opacity-0 transition duration-150 group-hover/help:pointer-events-auto group-hover/help:opacity-100 group-focus-within/help:pointer-events-auto group-focus-within/help:opacity-100"
      >
        {content}
      </span>
    </span>
  );
}
