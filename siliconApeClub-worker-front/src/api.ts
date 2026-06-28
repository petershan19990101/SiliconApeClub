import type { ConversationSession, DemandGroup, Employee, Principal, WorkerMessage, WorkerTask } from "./types";

const TOKEN_KEY = "sac_worker_token";
const API_BASE = "";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = (await response.json()) as { detail?: string };
      detail = body.detail || detail;
    } catch {
      // keep status text
    }
    throw new Error(detail);
  }
  return (await response.json()) as T;
}

export const api = {
  async login(username: string, password: string): Promise<{ token: string; principal: Principal }> {
    return request("/api/worker-platform/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
  },
  async me(): Promise<{ principal: Principal }> {
    return request("/api/worker-platform/auth/me");
  },
  async bootstrap(): Promise<{ principal: Principal; canViewOrg: boolean }> {
    return request("/api/worker-platform/bootstrap");
  },
  async demandGroups(): Promise<DemandGroup[]> {
    return request("/api/worker-platform/demand-groups");
  },
  async createDemandGroup(title: string, summary?: string, directEmployeeId?: string): Promise<DemandGroup> {
    return request("/api/worker-platform/demand-groups", {
      method: "POST",
      body: JSON.stringify({ title, summary, directEmployeeId })
    });
  },
  async demandGroup(id: string): Promise<DemandGroup> {
    return request(`/api/worker-platform/demand-groups/${id}`);
  },
  async sessions(groupId: string): Promise<ConversationSession[]> {
    return request(`/api/worker-platform/demand-groups/${groupId}/sessions`);
  },
  async messages(sessionId: string): Promise<WorkerMessage[]> {
    return request(`/api/worker-platform/sessions/${sessionId}/messages`);
  },
  async postMessage(sessionId: string, text: string): Promise<{ userMessage: WorkerMessage; assistantMessage: WorkerMessage; task?: WorkerTask }> {
    return request(`/api/worker-platform/sessions/${sessionId}/messages`, {
      method: "POST",
      body: JSON.stringify({ text })
    });
  },
  async postForm(sessionId: string, title: string, values: Record<string, string>): Promise<{ userMessage: WorkerMessage; assistantMessage: WorkerMessage; task?: WorkerTask }> {
    return request(`/api/worker-platform/sessions/${sessionId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        blocks: [
          {
            type: "markdown",
            content: `### ${title}\n\n${Object.entries(values)
              .map(([key, value]) => `- **${key}**: ${value || "未填写"}`)
              .join("\n")}`
          }
        ]
      })
    });
  },
  async employees(): Promise<Employee[]> {
    return request("/api/worker-platform/org/employees");
  },
  async tasks(): Promise<WorkerTask[]> {
    return request("/api/worker-platform/tasks");
  },
  async resumeTask(taskId: string): Promise<WorkerTask> {
    return request(`/api/worker-platform/tasks/${taskId}/resume`, { method: "POST", body: "{}" });
  },
  async cancelTask(taskId: string): Promise<WorkerTask> {
    return request(`/api/worker-platform/tasks/${taskId}/cancel`, { method: "POST", body: "{}" });
  },
  async assignEmployee(employeeId: string, demandGroupId: string, title: string): Promise<WorkerTask> {
    return request(`/api/worker-platform/org/employees/${employeeId}/assign`, {
      method: "POST",
      body: JSON.stringify({ demandGroupId, title, description: title })
    });
  }
};
