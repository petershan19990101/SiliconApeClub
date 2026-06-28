import { FormEvent, useEffect, useMemo, useState } from "react";
import DOMPurify from "dompurify";
import {
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ClipboardList,
  LogOut,
  MessageSquareText,
  PauseCircle,
  PlayCircle,
  Send,
  ShieldCheck,
  UserRoundCog
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api, getToken, setToken } from "./api";
import type { DemandGroup, Employee, FormBlockData, MessageBlock, Principal, WorkerMessage, WorkerTask } from "./types";

export default function App() {
  const [principal, setPrincipal] = useState<Principal | null>(null);
  const [username, setUsername] = useState("customer");
  const [password, setPassword] = useState("Customer@123");
  const [groups, setGroups] = useState<DemandGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<DemandGroup | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WorkerMessage[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tasks, setTasks] = useState<WorkerTask[]>([]);
  const [draft, setDraft] = useState("");
  const [newDemandTitle, setNewDemandTitle] = useState("新的客户需求");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canViewOrg = principal?.principalType === "admin" || principal?.principalType === "internal_user";
  const currentSession = selectedGroup?.sessions?.find((session) => session.id === selectedSessionId);

  useEffect(() => {
    if (!getToken()) {
      return;
    }
    api
      .me()
      .then(({ principal }) => {
        setPrincipal(principal);
        return loadWorkspace();
      })
      .catch(() => setToken(null));
  }, []);

  async function loadWorkspace(nextGroupId?: string) {
    const [groupList, taskList] = await Promise.all([api.demandGroups(), api.tasks().catch(() => [])]);
    setGroups(groupList);
    setTasks(taskList);
    const groupId = nextGroupId || selectedGroup?.id || groupList[0]?.id;
    if (groupId) {
      await loadGroup(groupId);
    } else {
      setSelectedGroup(null);
      setMessages([]);
      setSelectedSessionId(null);
    }
    try {
      setEmployees(await api.employees());
    } catch {
      setEmployees([]);
    }
  }

  async function loadGroup(groupId: string) {
    const group = await api.demandGroup(groupId);
    setSelectedGroup(group);
    const firstSession = group.sessions?.[0];
    setSelectedSessionId(firstSession?.id || null);
    if (firstSession) {
      setMessages(await api.messages(firstSession.id));
    } else {
      setMessages([]);
    }
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.login(username, password);
      setToken(result.token);
      setPrincipal(result.principal);
      await loadWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setBusy(false);
    }
  }

  async function createDemand(directEmployeeId?: string) {
    setBusy(true);
    setError(null);
    try {
      const group = await api.createDemandGroup(newDemandTitle || "新的客户需求", "客户端创建", directEmployeeId);
      await loadWorkspace(group.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建需求失败");
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();
    if (!selectedSessionId || !draft.trim()) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await api.postMessage(selectedSessionId, draft.trim());
      setMessages((items) => [...items, response.userMessage, response.assistantMessage]);
      setDraft("");
      await loadWorkspace(selectedGroup?.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败");
    } finally {
      setBusy(false);
    }
  }

  async function submitForm(title: string, values: Record<string, string>) {
    if (!selectedSessionId) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await api.postForm(selectedSessionId, title, values);
      setMessages((items) => [...items, response.userMessage, response.assistantMessage]);
      await loadWorkspace(selectedGroup?.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    } finally {
      setBusy(false);
    }
  }

  async function resumeTask(taskId: string) {
    setBusy(true);
    try {
      await api.resumeTask(taskId);
      await loadWorkspace(selectedGroup?.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "恢复任务失败");
    } finally {
      setBusy(false);
    }
  }

  async function cancelTask(taskId: string) {
    setBusy(true);
    try {
      await api.cancelTask(taskId);
      await loadWorkspace(selectedGroup?.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "取消任务失败");
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    setToken(null);
    setPrincipal(null);
    setGroups([]);
    setSelectedGroup(null);
    setMessages([]);
    setEmployees([]);
    setTasks([]);
  }

  if (!principal) {
    return (
      <main className="login-shell">
        <section className="login-panel">
          <div className="brand-mark">
            <Building2 size={34} />
          </div>
          <h1>硅基猿猴俱乐部 AI 员工平台</h1>
          <form className="login-form" onSubmit={handleLogin}>
            <label>
              账号
              <input value={username} onChange={(event) => setUsername(event.target.value)} />
            </label>
            <label>
              密码
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            <div className="login-presets">
              <button type="button" onClick={() => { setUsername("customer"); setPassword("Customer@123"); }}>外部客户</button>
              <button type="button" onClick={() => { setUsername("internal"); setPassword("Internal@123"); }}>内部人员</button>
              <button type="button" onClick={() => { setUsername("admin"); setPassword("Admin@123"); }}>管理员</button>
            </div>
            {error ? <p className="error-text">{error}</p> : null}
            <button className="primary-button" type="submit" disabled={busy}>
              <ShieldCheck size={18} />
              登录
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="workspace">
      <header className="topbar">
        <div>
          <p className="eyebrow">Silicon Ape Club Worker Platform</p>
          <h1>AI 员工需求工作台</h1>
        </div>
        <div className="user-pill">
          <span>{principal.displayName}</span>
          <small>{principal.principalType}</small>
          <button aria-label="退出登录" onClick={logout}><LogOut size={17} /></button>
        </div>
      </header>

      <section className="columns">
        <aside className="sidebar demand-sidebar">
          <div className="section-title">
            <ClipboardList size={18} />
            <span>客户历史需求</span>
          </div>
          <div className="new-demand">
            <input value={newDemandTitle} onChange={(event) => setNewDemandTitle(event.target.value)} />
            <button onClick={() => createDemand()} disabled={busy}>新建</button>
          </div>
          <div className="demand-list">
            {groups.map((group) => (
              <button
                key={group.id}
                className={group.id === selectedGroup?.id ? "demand-item active" : "demand-item"}
                onClick={() => loadGroup(group.id)}
              >
                <strong>{group.title}</strong>
                <span>{group.status} · {group.sessionCount || group.sessions?.length || 0} 会话 · {group.taskCount || group.tasks?.length || 0} 任务</span>
                <small>{group.assignedEmployeeName || group.intakeEmployeeName || "业务前台"}</small>
              </button>
            ))}
          </div>
        </aside>

        <section className="chat-panel">
          <div className="chat-header">
            <div>
              <p className="eyebrow">{selectedGroup?.ownerName || principal.displayName}</p>
              <h2>{selectedGroup?.title || "尚未选择需求"}</h2>
            </div>
            <div className="session-tabs">
              {selectedGroup?.sessions?.map((session) => (
                <button
                  key={session.id}
                  className={session.id === selectedSessionId ? "active" : ""}
                  onClick={async () => {
                    setSelectedSessionId(session.id);
                    setMessages(await api.messages(session.id));
                  }}
                >
                  <MessageSquareText size={15} />
                  {session.title}
                </button>
              ))}
            </div>
          </div>

          {error ? <div className="inline-error">{error}</div> : null}

          <div className="message-stream">
            {messages.map((message) => (
              <article key={message.id} className={message.senderType === "principal" ? "message own" : "message"}>
                <div className="message-meta">
                  <strong>{message.senderName}</strong>
                  <span>{new Date(message.createdAt).toLocaleString()}</span>
                </div>
                <div className="block-stack">
                  {message.blocks.map((block, index) => (
                    <BlockRenderer key={`${message.id}-${index}`} block={block} onSubmitForm={submitForm} />
                  ))}
                </div>
              </article>
            ))}
          </div>

          <form className="composer" onSubmit={sendMessage}>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={currentSession ? "输入任务指令、补充信息或验收反馈" : "先创建或选择一个需求"}
              disabled={!currentSession || busy}
            />
            <button type="submit" disabled={!currentSession || busy || !draft.trim()} aria-label="发送">
              <Send size={19} />
            </button>
          </form>
        </section>

        <aside className="sidebar org-sidebar">
          <div className="section-title">
            <UserRoundCog size={18} />
            <span>组织与任务</span>
          </div>

          {canViewOrg ? (
            <div className="employee-list">
              {employees.map((employee) => (
                <div className="employee-row" key={employee.id}>
                  <div>
                    <strong>{employee.name}</strong>
                    <span>{employee.roleTitle}</span>
                    <small>{employee.orgUnitName}</small>
                  </div>
                  <div className="row-actions">
                    <button
                      disabled={!employee.canAssign}
                      onClick={() => createDemand(employee.id)}
                      title="直接指定员工创建需求"
                    >
                      <BriefcaseBusiness size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="frontdesk-note">
              <CheckCircle2 size={18} />
              <span>当前由业务前台统一接待。</span>
            </div>
          )}

          <div className="section-title task-title">
            <ClipboardList size={18} />
            <span>任务账本</span>
          </div>
          <div className="task-list">
            {tasksForCurrentGroup(tasks, selectedGroup?.id).map((task) => (
              <div className="task-row" key={task.id}>
                <div className="task-head">
                  <strong>{task.title}</strong>
                  <StatusBadge status={task.status} />
                </div>
                <div className="progress-line">
                  <span style={{ width: `${Math.max(4, task.progress || 0)}%` }} />
                </div>
                <small>{task.assignedEmployeeName || "待分派"} · {task.progress || 0}%</small>
                <div className="row-actions">
                  <button onClick={() => resumeTask(task.id)} disabled={busy || task.status === "completed" || task.status === "cancelled"}>
                    <PlayCircle size={15} />
                  </button>
                  <button onClick={() => cancelTask(task.id)} disabled={busy || task.status === "completed" || task.status === "cancelled"}>
                    <PauseCircle size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}

function BlockRenderer({ block, onSubmitForm }: { block: MessageBlock; onSubmitForm: (title: string, values: Record<string, string>) => void }) {
  if (block.type === "markdown") {
    return (
      <div className="markdown-block">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{block.content || ""}</ReactMarkdown>
      </div>
    );
  }

  if (block.type === "html") {
    return (
      <div className="html-block">
        {block.title ? <strong>{block.title}</strong> : null}
        <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(block.content || "") }} />
      </div>
    );
  }

  if (block.type === "form") {
    return <DynamicForm title={block.title || "结构化表单"} data={block.data} onSubmit={onSubmitForm} />;
  }

  if (block.type === "task_status") {
    return (
      <div className="info-block task-status-block">
        <strong>{block.title || "任务状态"}</strong>
        <span>{String(block.data?.status || "queued")}</span>
        <div className="progress-line">
          <span style={{ width: `${Number(block.data?.progress || 0)}%` }} />
        </div>
        <small>{String(block.data?.taskId || "")}</small>
      </div>
    );
  }

  if (block.type === "org_route") {
    const from = block.data?.from as { name?: string; role?: string } | undefined;
    const to = block.data?.to as { name?: string; role?: string } | undefined;
    return (
      <div className="info-block route-block">
        <strong>{block.title || "组织派发路径"}</strong>
        <div className="route-line">
          <span>{from?.name || "前台"}</span>
          <i />
          <span>{to?.name || "目标员工"}</span>
        </div>
        <small>{String(block.data?.reason || "")}</small>
      </div>
    );
  }

  if (block.type === "employee_card") {
    const capabilities = Array.isArray(block.data?.capabilities) ? block.data.capabilities : [];
    return (
      <div className="info-block employee-card">
        <strong>{block.title}</strong>
        <span>{String(block.data?.roleTitle || "")}</span>
        <p>{String(block.data?.description || "")}</p>
        <div className="capability-list">
          {capabilities.map((item) => <small key={String(item)}>{String(item)}</small>)}
        </div>
      </div>
    );
  }

  if (block.type === "artifact") {
    return (
      <div className="info-block">
        <strong>{block.title || "产出物"}</strong>
        <a href={String(block.data?.uri || "#")} target="_blank" rel="noreferrer">{String(block.data?.artifactType || "artifact")}</a>
      </div>
    );
  }

  return (
    <pre className="json-block">{JSON.stringify(block, null, 2)}</pre>
  );
}

function DynamicForm({ title, data, onSubmit }: { title: string; data: FormBlockData; onSubmit: (title: string, values: Record<string, string>) => void }) {
  const initialValues = useMemo(() => {
    const values: Record<string, string> = {};
    data.fields?.forEach((field) => {
      values[field.name] = field.defaultValue || "";
    });
    return values;
  }, [data.fields]);
  const [values, setValues] = useState<Record<string, string>>(initialValues);

  return (
    <form
      className="dynamic-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(title, values);
      }}
    >
      <strong>{title}</strong>
      {data.fields?.map((field) => (
        <label key={field.name}>
          {field.label}
          {field.type === "textarea" ? (
            <textarea
              required={field.required}
              value={values[field.name] || ""}
              onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
            />
          ) : field.type === "select" ? (
            <select
              required={field.required}
              value={values[field.name] || ""}
              onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
            >
              <option value="">请选择</option>
              {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          ) : (
            <input
              required={field.required}
              value={values[field.name] || ""}
              onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
            />
          )}
        </label>
      ))}
      <button type="submit">{data.submitLabel || "提交"}</button>
    </form>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`status-badge status-${status}`}>{status}</span>;
}

function tasksForCurrentGroup(tasks: WorkerTask[], groupId?: string) {
  if (!groupId) {
    return tasks.slice(0, 8);
  }
  return tasks.filter((task) => task.demandGroupId === groupId).slice(0, 8);
}
