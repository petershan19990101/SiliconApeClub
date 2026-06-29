import { FormEvent, useEffect, useMemo, useState } from "react";
import DOMPurify from "dompurify";
import {
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  LogOut,
  MessageSquareText,
  PauseCircle,
  PlayCircle,
  ShoppingCart,
  Send,
  ShieldCheck,
  UserRoundCog
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api, getToken, setToken } from "./api";
import type { Capability, DemandGroup, Employee, FormBlockData, FormOption, MessageBlock, Principal, WorkerMessage, WorkerTask } from "./types";

export default function App() {
  const [principal, setPrincipal] = useState<Principal | null>(null);
  const [username, setUsername] = useState("customer");
  const [password, setPassword] = useState("Customer@123");
  const [groups, setGroups] = useState<DemandGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<DemandGroup | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WorkerMessage[]>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tasks, setTasks] = useState<WorkerTask[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [collapsedCapabilityGroups, setCollapsedCapabilityGroups] = useState<Record<string, boolean>>({});
  const [expandedEmployeeDepartments, setExpandedEmployeeDepartments] = useState<Record<string, boolean>>({});

  const currentSession = selectedGroup?.sessions?.find((session) => session.id === selectedSessionId);
  const visibleCapabilities = capabilities.filter((capability) => capability.defaultVisible !== false);
  const capabilityGroups = useMemo(() => groupCapabilities(visibleCapabilities), [visibleCapabilities]);
  const employeeGroups = useMemo(() => groupEmployees(employees), [employees]);
  const visibleMessages = useMemo(
    () => normalizeMessages(messages).filter((message) => message.blocks.length > 0),
    [messages]
  );

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
    const [groupList, taskList, capabilityList] = await Promise.all([
      api.demandGroups(),
      api.tasks().catch(() => []),
      api.capabilities().catch(() => [])
    ]);
    setGroups(groupList);
    setTasks(taskList);
    setCapabilities(capabilityList);
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
      setMessages(normalizeMessages(await api.messages(firstSession.id)));
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
      const group = await api.createDemandGroup(defaultConversationTitle(), "客户端服务对话", directEmployeeId);
      await loadWorkspace(group.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "开始对话失败");
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
      setMessages((items) => normalizeMessages([...items, response.userMessage, response.assistantMessage]));
      setDraft("");
      await loadWorkspace(selectedGroup?.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败");
    } finally {
      setBusy(false);
    }
  }

  async function openCapability(capability: Capability) {
    setBusy(true);
    setError(null);
    try {
      let groupId = selectedGroup?.id;
      let sessionId = selectedSessionId;
      if (!sessionId) {
        const group = await api.createDemandGroup(defaultConversationTitle(), `快捷能力：${capability.name}`);
        groupId = group.id;
        sessionId = group.sessions?.[0]?.id || null;
      }
      if (!sessionId) {
        throw new Error("请先开始服务对话");
      }
      await api.openCapability(sessionId, capability.code);
      await loadWorkspace(groupId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "打开能力失败");
    } finally {
      setBusy(false);
    }
  }

  async function submitForm(title: string, data: FormBlockData, values: Record<string, string>) {
    if (!selectedSessionId) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await api.postForm(selectedSessionId, title, data, values);
      setMessages((items) => normalizeMessages([...items, response.userMessage, response.assistantMessage]));
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
          <h1>AI 员工服务台</h1>
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
            <span>历史对话</span>
          </div>
          <div className="new-demand">
            <button onClick={() => createDemand()} disabled={busy}>开始对话</button>
          </div>
          <div className="demand-list">
            {groups.map((group) => (
              <button
                key={group.id}
                className={group.id === selectedGroup?.id ? "demand-item active" : "demand-item"}
                onClick={() => loadGroup(group.id)}
              >
                <strong>{displayConversationTitle(group.title)}</strong>
                <span>{group.status} · {group.sessionCount || group.sessions?.length || 0} 轮对话 · {group.taskCount || group.tasks?.length || 0} 任务</span>
                <small>{group.assignedEmployeeName || group.intakeEmployeeName || "业务前台"}</small>
              </button>
            ))}
          </div>
        </aside>

        <section className="chat-panel">
          <div className="chat-header">
            <div>
              <p className="eyebrow">{selectedGroup?.ownerName || principal.displayName}</p>
              <h2>{selectedGroup ? displayConversationTitle(selectedGroup.title) : "尚未开始对话"}</h2>
            </div>
            <div className="session-tabs">
              {selectedGroup?.sessions?.map((session) => (
                <button
                  key={session.id}
                  className={session.id === selectedSessionId ? "active" : ""}
                  onClick={async () => {
                    setSelectedSessionId(session.id);
                    setMessages(normalizeMessages(await api.messages(session.id)));
                  }}
                >
                  <MessageSquareText size={15} />
                  {displayConversationTitle(session.title)}
                </button>
              ))}
            </div>
          </div>

          {error ? <div className="inline-error">{error}</div> : null}

          <div className="message-stream">
            {visibleMessages.map((message) => (
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
              rows={1}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={currentSession ? "直接描述要办理或咨询的事情" : "先开始或选择一段对话"}
              disabled={!currentSession || busy}
            />
            <button type="submit" disabled={!currentSession || busy || !draft.trim()} aria-label="发送">
              <Send size={19} />
            </button>
          </form>
        </section>

        <aside className="sidebar org-sidebar">
          <div className="section-title">
            <ShoppingCart size={18} />
            <span>快捷能力</span>
          </div>
          <div className="capability-panel">
            {capabilityGroups.map((group) => {
              const collapsed = collapsedCapabilityGroups[group.key] === true;
              return (
                <div className="capability-group" key={group.key}>
                  <button
                    type="button"
                    className="group-toggle"
                    onClick={() => setCollapsedCapabilityGroups((current) => ({ ...current, [group.key]: !collapsed }))}
                  >
                    <span>{group.name}</span>
                    <small>{group.items.length}</small>
                    {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                  </button>
                  {!collapsed ? (
                    <div className="capability-group-items">
                      {group.items.map((capability) => (
                        <button key={capability.code} className="capability-button" onClick={() => void openCapability(capability)} disabled={busy}>
                          <strong>{capability.name}</strong>
                          <span>{capability.description || capability.actionCode}</span>
                          {capability.transactionServiceCode ? <small>{capability.transactionServiceCode}</small> : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {visibleCapabilities.length === 0 ? <div className="frontdesk-note"><span>暂无可用能力</span></div> : null}
          </div>

          <div className="section-title task-title">
            <UserRoundCog size={18} />
            <span>员工直通</span>
          </div>

          {employeeGroups.length ? (
            <div className="employee-list">
              {employeeGroups.map((group) => {
                const expanded = expandedEmployeeDepartments[group.key] === true;
                return (
                  <div className="employee-department" key={group.key}>
                    <button
                      type="button"
                      className="group-toggle"
                      onClick={() => setExpandedEmployeeDepartments((current) => ({ ...current, [group.key]: !expanded }))}
                    >
                      <span>{group.name}</span>
                      <small>{group.items.length}</small>
                      {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </button>
                    {expanded ? (
                      <div className="employee-department-items">
                        {group.items.map((employee) => (
                          <div className="employee-row" key={employee.id}>
                            <div>
                              <strong>{employee.name}</strong>
                              <span>{employee.roleTitle}</span>
                              <small>{employee.canConsult ? "可咨询" : "不可咨询"} · {employee.canAssign ? "可派活" : "不可派活"}</small>
                            </div>
                            <div className="row-actions">
                              <button
                                disabled={!employee.canAssign}
                                onClick={() => createDemand(employee.id)}
                                title="直接指定员工开始对话"
                              >
                                <BriefcaseBusiness size={15} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
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

function BlockRenderer({ block, onSubmitForm }: { block: MessageBlock; onSubmitForm: (title: string, data: FormBlockData, values: Record<string, string>) => void }) {
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

  if (block.type === "code") {
    const code = String(block.content || block.data?.code || "");
    const language = String(block.data?.language || "text");
    return (
      <div className="code-block">
        {block.title ? <strong>{block.title}</strong> : null}
        <pre><code data-language={language}>{code}</code></pre>
      </div>
    );
  }

  if (block.type === "image") {
    const src = String(block.data?.uri || block.data?.url || block.content || "");
    return (
      <figure className="image-block">
        <img src={src} alt={block.title || "图片"} />
        {block.title ? <figcaption>{block.title}</figcaption> : null}
      </figure>
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
    const uri = String(block.data?.uri || "#");
    const artifactType = String(block.data?.artifactType || "artifact");
    const isImage = artifactType.toLowerCase().includes("image") || /\.(png|jpe?g|gif|webp|svg)$/i.test(uri);
    return (
      <div className="info-block artifact-block">
        <strong>{block.title || "产出物"}</strong>
        {isImage ? <img src={uri} alt={block.title || "图片产出"} /> : null}
        <a href={uri} target="_blank" rel="noreferrer">{artifactType}</a>
      </div>
    );
  }

  if (typeof block.content === "string") {
    return (
      <div className="markdown-block">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{block.content}</ReactMarkdown>
      </div>
    );
  }

  return (
    <pre className="json-block">{JSON.stringify(block, null, 2)}</pre>
  );
}

function DynamicForm({ title, data, onSubmit }: { title: string; data: FormBlockData; onSubmit: (title: string, data: FormBlockData, values: Record<string, string>) => void }) {
  const initialValues = useMemo(() => {
    const values: Record<string, string> = {};
    data.fields?.forEach((field) => {
      values[field.name] = data.values?.[field.name] || field.defaultValue || "";
    });
    return values;
  }, [data.fields, data.values]);
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const readonly = data.readOnly || data.submitted;

  if (readonly) {
    return (
      <div className="dynamic-form submitted-form">
        <strong>{title}</strong>
        <div className="submission-grid">
          {data.fields?.map((field) => (
            <div key={field.name}>
              <span>{field.label}</span>
              <b>{values[field.name] || "未填写"}</b>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <form
      className="dynamic-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(title, data, values);
      }}
    >
      <strong>{title}</strong>
      {data.htmlContent ? (
        <div className="form-html" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(data.htmlContent) }} />
      ) : null}
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
              {field.options?.map((option) => <option key={optionValue(option)} value={optionValue(option)}>{optionLabel(option)}</option>)}
            </select>
          ) : (
            <input
              type={field.type}
              required={field.required}
              placeholder={field.placeholder}
              value={values[field.name] || ""}
              onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
            />
          )}
          {field.helpText ? <small>{field.helpText}</small> : null}
        </label>
      ))}
      <button type="submit">{data.submitLabel || "提交"}</button>
    </form>
  );
}

function optionValue(option: string | FormOption) {
  return typeof option === "string" ? option : option.value;
}

function optionLabel(option: string | FormOption) {
  return typeof option === "string" ? option : option.label;
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

function groupCapabilities(items: Capability[]) {
  const map = new Map<string, { key: string; name: string; sort: number; items: Capability[] }>();
  items.forEach((item) => {
    const key = item.groupCode || "default";
    if (!map.has(key)) {
      map.set(key, { key, name: item.groupName || "常用能力", sort: item.groupSort ?? 100, items: [] });
    }
    map.get(key)?.items.push(item);
  });
  return Array.from(map.values())
    .map((group) => ({ ...group, items: group.items.sort((left, right) => (left.sortOrder ?? 100) - (right.sortOrder ?? 100)) }))
    .sort((left, right) => left.sort - right.sort || left.name.localeCompare(right.name, "zh-CN"));
}

function groupEmployees(items: Employee[]) {
  const map = new Map<string, { key: string; name: string; items: Employee[] }>();
  items.forEach((item) => {
    const key = item.orgUnitId || item.orgUnitName || "unknown";
    if (!map.has(key)) {
      map.set(key, { key, name: item.orgUnitName || "未分组员工", items: [] });
    }
    map.get(key)?.items.push(item);
  });
  return Array.from(map.values())
    .map((group) => ({ ...group, items: group.items.sort((left, right) => left.name.localeCompare(right.name, "zh-CN")) }))
    .sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));
}

function defaultConversationTitle() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  return `服务对话 ${month}-${day} ${hour}:${minute}`;
}

function displayConversationTitle(title?: string) {
  const normalized = (title || "").trim();
  if (!normalized || normalized === "新的客户需求" || normalized === "新的需求沟通" || normalized === "需求登记") {
    return "服务对话";
  }
  if (normalized.includes("新的客户需求") || normalized.includes("需求登记")) {
    return "服务对话";
  }
  return normalized;
}

function normalizeMessages(items: WorkerMessage[]) {
  return items.map((message) => ({
    ...message,
    blocks: message.blocks.map(normalizeBlock).filter((block): block is MessageBlock => Boolean(block))
  }));
}

function normalizeBlock(block: MessageBlock): MessageBlock | null {
  if (isLegacyIntakeForm(block)) {
    return null;
  }
  if (block.type === "markdown" && typeof block.content === "string") {
    return { ...block, content: normalizeSystemCopy(block.content) };
  }
  return block;
}

function isLegacyIntakeForm(block: MessageBlock) {
  if (block.type !== "form") {
    return false;
  }
  const fieldNames = new Set((block.data?.fields || []).map((field) => field.name));
  return (
    (block.title || "").includes("需求登记") ||
    (block.data?.submitLabel || "").includes("需求登记") ||
    (fieldNames.has("businessGoal") && fieldNames.has("expectedOutput") && fieldNames.has("materials"))
  );
}

function normalizeSystemCopy(content: string) {
  return content
    .replace(
      "你好，我是 **业务前台 Ada**。我会先接待和澄清需求，再按组织关系拆分给合适的团队。",
      "你好，我是 **业务前台 Ada**。你可以直接说明要办理或咨询的事情；需要精确入参时，我会再给你对应表单。"
    )
    .replace(
      "我会先接待和澄清需求，再按组织关系拆分给合适的团队。",
      "你可以直接说明要办理或咨询的事情；需要精确入参时，我会再给你对应表单。"
    );
}
