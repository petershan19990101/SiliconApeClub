import React, { useEffect, useMemo, useState } from 'react';
import { Bot, Cpu, FileText, LayoutTemplate, Settings2, SlidersHorizontal } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { SystemMenuNode } from '../types';
import { ParseConfigSettings } from './settings/ParseConfigSettings';
import { AiModelSettings } from './settings/AiModelSettings';
import { SettingsPlaceholder } from './settings/SettingsPlaceholder';
import { InlineHelpTip } from './ui/InlineHelpTip';

type SettingsTab =
  | 'settings_parse_config'
  | 'settings_ai_model'
  | 'settings_document_policy'
  | 'settings_integration_switches'
  | 'settings_platform_info';

const TAB_META: Record<SettingsTab, {
  title: string;
  description: string;
  icon: typeof SlidersHorizontal;
}> = {
  settings_parse_config: {
    title: '解析配置',
    description: '维护文件类型与解析引擎之间的数据库绑定关系，作为文档解析链路的运行时配置入口。',
    icon: SlidersHorizontal,
  },
  settings_ai_model: {
    title: 'AI 模型配置',
    description: '维护文档生成 LLM Wiki、RAG Embedding/Rerank 与 AI 员工分析所使用的模型 profile。',
    icon: Bot,
  },
  settings_document_policy: {
    title: '文档策略',
    description: '后续集中承载上传策略、版本保留策略、审核前置规则等平台级文档策略。',
    icon: FileText,
  },
  settings_integration_switches: {
    title: '集成开关',
    description: '后续用于展示并维护 RAG、异步任务、外部组件接入等系统级开关和状态。',
    icon: Cpu,
  },
  settings_platform_info: {
    title: '平台信息',
    description: '后续可维护平台名称、Logo、帮助链接、公告和页脚说明等基础展示信息。',
    icon: LayoutTemplate,
  },
};

export function SystemSettings() {
  const { currentUser } = useUser();
  const settingsRoot = useMemo(
    () => (currentUser?.menus ?? []).find((menu) => menu.routeKey === 'settings'),
    [currentUser?.menus]
  );

  const availableTabs = useMemo(() => {
    const children = settingsRoot?.children ?? [];
    return children.filter((item) => item.routeKey && item.routeKey in TAB_META) as Array<SystemMenuNode & { routeKey: SettingsTab }>;
  }, [settingsRoot]);

  const [activeTab, setActiveTab] = useState<SettingsTab>('settings_parse_config');

  useEffect(() => {
    if (!availableTabs.length) {
      return;
    }
    if (!availableTabs.some((tab) => tab.routeKey === activeTab)) {
      setActiveTab(availableTabs[0].routeKey);
    }
  }, [activeTab, availableTabs]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white px-8 py-7 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-700 text-white shadow-lg shadow-blue-700/20">
            <Settings2 size={24} />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">系统设置</h1>
            <InlineHelpTip content="把平台级参数、解析配置和系统开关集中到一个稳定入口，后续可以在这里持续扩展。" />
          </div>
        </div>
      </div>

      {!availableTabs.length ? (
        <div className="rounded-3xl border border-slate-200 bg-white px-8 py-12 text-center shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">暂无可访问的设置项</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-500">
            当前账号已进入系统设置页面，但还没有被授予具体的二级模块权限。等系统管理员配置对应子页面权限后，这里会自动显示可访问的设置项。
          </p>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-2 px-2">
              <div className="text-sm font-bold text-slate-900">设置导航</div>
              <InlineHelpTip content="左侧按权限显示子页入口，本期先从解析配置开始落真实能力。" />
            </div>
            <div className="rounded-2xl bg-slate-100 p-2">
              <div className="space-y-2">
              {availableTabs.map((tab) => {
                const meta = TAB_META[tab.routeKey];
                const Icon = meta.icon;
                const active = activeTab === tab.routeKey;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.routeKey)}
                    className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${
                      active ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-white/70 hover:text-slate-700'
                    }`}
                  >
                    <div className={`rounded-xl p-2 ${active ? 'bg-blue-50 text-blue-700' : 'bg-white text-slate-500'}`}>
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold">{tab.name}</div>
                    </div>
                    <InlineHelpTip content={meta.description} className={active ? 'text-blue-400' : ''} />
                  </button>
                );
              })}
              </div>
            </div>
          </aside>

          <div>{renderTab(activeTab)}</div>
        </div>
      )}
    </div>
  );
}

function renderTab(tab: SettingsTab) {
  switch (tab) {
    case 'settings_ai_model':
      return <AiModelSettings />;
    case 'settings_document_policy':
      return <SettingsPlaceholder title="文档策略" description={TAB_META.settings_document_policy.description} icon={TAB_META.settings_document_policy.icon} />;
    case 'settings_integration_switches':
      return <SettingsPlaceholder title="集成开关" description={TAB_META.settings_integration_switches.description} icon={TAB_META.settings_integration_switches.icon} />;
    case 'settings_platform_info':
      return <SettingsPlaceholder title="平台信息" description={TAB_META.settings_platform_info.description} icon={TAB_META.settings_platform_info.icon} />;
    default:
      return <ParseConfigSettings />;
  }
}
