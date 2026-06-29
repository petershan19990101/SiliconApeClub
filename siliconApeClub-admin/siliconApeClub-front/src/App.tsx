/**
 * 前端应用入口组件，负责装配全局上下文、主布局和页面视图切换。
 */
import React from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { Library } from './components/Library';
import { SearchResults } from './components/SearchResults';
import { AuthScreen } from './components/AuthScreen';
import { PermissionCenter } from './components/permissions/PermissionCenter';
import { SystemSettings } from './components/SystemSettings';
import { HelpCenter } from './components/HelpCenter';
import { AiEmployees } from './components/knowledge/AiEmployees';
import { KnowledgeHealth } from './components/knowledge/KnowledgeHealth';
import { PositionPackages } from './components/knowledge/PositionPackages';
import { RagDebug } from './components/knowledge/RagDebug';
import { QuickCapabilities } from './components/knowledge/QuickCapabilities';
import { SkillRepository } from './components/knowledge/SkillRepository';
import { WikiPages } from './components/knowledge/WikiPages';
import { AppShellProvider, useAppShell } from './contexts/AppShellContext';
import { ToastProvider } from './contexts/ToastContext';
import { UserProvider, useUser } from './contexts/UserContext';
import { getVisibleViews } from './lib/systemPermissions';

function AppContent() {
  const { currentView } = useAppShell();
  const { currentUser, isLoading, isAuthenticated } = useUser();

  const renderView = (view = currentView) => {
    switch (view) {
      case 'dashboard':
        return <Dashboard />;
      case 'library':
        return <Library />;
      case 'search':
        return <SearchResults />;
      case 'permission':
        return <PermissionCenter />;
      case 'wiki':
        return <WikiPages />;
      case 'position_packages':
        return <PositionPackages />;
      case 'knowledge_health':
        return <KnowledgeHealth />;
      case 'rag_debug':
        return <RagDebug />;
      case 'ai_employees':
        return <AiEmployees />;
      case 'skill_repository':
        return <SkillRepository />;
      case 'quick_capabilities':
        return <QuickCapabilities />;
      case 'customer_members':
        return <AiEmployees defaultSection="customers" />;
      case 'settings':
        return <SystemSettings />;
      case 'help':
        return <HelpCenter />;
      default:
        return <Dashboard />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-blue-700" />
      </div>
    );
  }

  if (!isAuthenticated || !currentUser) {
    return <AuthScreen />;
  }

  const visibleViews = getVisibleViews(currentUser);
  const safeView = visibleViews.includes(currentView) ? currentView : visibleViews[0];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="custom-scrollbar flex-1 overflow-y-auto p-8">{renderView(safeView)}</main>
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 999px;
        }
      `}</style>
    </div>
  );
}

export default function App() {
  return (
    <UserProvider>
      <ToastProvider>
        <AppShellProvider>
          <AppContent />
        </AppShellProvider>
      </ToastProvider>
    </UserProvider>
  );
}
