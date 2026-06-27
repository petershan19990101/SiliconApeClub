import React from 'react';
import { Clock3, LucideIcon } from 'lucide-react';
import { InlineHelpTip } from '../ui/InlineHelpTip';

export function SettingsPlaceholder({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
          <Icon size={22} />
        </div>
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          <InlineHelpTip content={description} />
        </div>
      </div>

      <div className="mt-8 rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
          <Clock3 size={20} />
        </div>
        <div className="mt-4 text-lg font-bold text-slate-900">建设中</div>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          当前模块已纳入系统设置导航，后续会在这里逐步接入真实配置能力。
        </p>
      </div>
    </section>
  );
}
