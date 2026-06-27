import { AiEmployee, HealthIssue, HealthReport, PositionPackage, WikiPage } from '../types';
import { getAuthToken } from '../lib/authStorage';
import { parseJsonResponse } from './json';

const env = import.meta.env as Record<string, string | undefined>;
const API_BASE_URL = env.VITE_API_BASE_URL ?? 'http://localhost:8080';
const RETRIEVAL_BASE_URL = env.VITE_RETRIEVAL_BASE_URL ?? 'http://localhost:8090';

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? {});
  headers.set('Accept', 'application/json');
  const token = getAuthToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  const payload = await parseJsonResponse<ApiEnvelope<T>>(response);
  if (!response.ok || !payload.success) {
    throw new Error(payload.message || `Request failed with status ${response.status}`);
  }
  return payload.data;
}

async function retrievalRequest<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${RETRIEVAL_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Retrieval request failed with status ${response.status}`);
  }
  return parseJsonResponse<T>(response);
}

function normalizeRecord<T extends Record<string, unknown>>(record: T): T {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, value == null ? undefined : value])) as T;
}

export const knowledgeApi = {
  listWikiPages: (query = '') => request<WikiPage[]>(`/api/wiki/pages${query ? `?query=${encodeURIComponent(query)}` : ''}`),
  getWikiPage: (id: string) => request<WikiPage>(`/api/wiki/pages/${id}`),
  createWikiPage: (payload: Partial<WikiPage>) =>
    request<WikiPage>('/api/wiki/pages', { method: 'POST', body: JSON.stringify(normalizeRecord(payload as Record<string, unknown>)) }),
  updateWikiPage: (id: string, payload: Partial<WikiPage>) =>
    request<WikiPage>(`/api/wiki/pages/${id}`, { method: 'PUT', body: JSON.stringify(normalizeRecord(payload as Record<string, unknown>)) }),
  publishWikiPage: (id: string) => request<WikiPage>(`/api/wiki/pages/${id}/publish`, { method: 'POST' }),
  archiveWikiPage: (id: string) => request<WikiPage>(`/api/wiki/pages/${id}/archive`, { method: 'POST' }),
  getWikiSyncStatus: (id: string) => request<Record<string, unknown>>(`/api/wiki/pages/${id}/sync-status`),

  listPositionPackages: () => request<PositionPackage[]>('/api/position-packages'),
  createPositionPackage: (payload: Partial<PositionPackage>) =>
    request<PositionPackage>('/api/position-packages', { method: 'POST', body: JSON.stringify(payload) }),
  publishPositionPackage: (id: string) => request<PositionPackage>(`/api/position-packages/${id}/publish`, { method: 'POST' }),

  listHealthIssues: () => request<HealthIssue[]>('/api/knowledge-health/issues'),
  listHealthReports: () => request<HealthReport[]>('/api/knowledge-health/reports'),
  generateHealthReport: () => request<HealthReport>('/api/knowledge-health/reports/generate', { method: 'POST' }),
  getMaintenanceWindow: () => request<Record<string, unknown>>('/api/knowledge-health/maintenance-window'),
  startMaintenanceWindow: (reason: string) =>
    request<Record<string, unknown>>('/api/knowledge-health/maintenance-window/start', { method: 'POST', body: JSON.stringify({ reason }) }),
  endMaintenanceWindow: () => request<Record<string, unknown>>('/api/knowledge-health/maintenance-window/end', { method: 'POST' }),

  listAiEmployees: () => request<AiEmployee[]>('/api/admin/ai-employees'),
  createAiEmployee: (payload: Partial<AiEmployee>) =>
    request<AiEmployee>('/api/admin/ai-employees', { method: 'POST', body: JSON.stringify(payload) }),

  searchRetrieval: (payload: unknown) => retrievalRequest<Record<string, unknown>>('/api/retrieval/debug', payload),
};
