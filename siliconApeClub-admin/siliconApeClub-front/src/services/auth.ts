/**
 * 认证服务，负责登录、获取当前用户和退出登录相关的 HTTP 调用。
 */
import { PermissionAction, RoleOption, SystemMenuNode, User } from '../types';
import { clearAuthToken, getAuthToken, setAuthToken } from '../lib/authStorage';
import { parseJsonResponse } from './json';

const env = import.meta.env as Record<string, string | undefined>;
const API_BASE_URL = env.VITE_API_BASE_URL ?? 'http://localhost:8080';

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
};

type ApiUser = {
  id: number;
  username: string;
  name: string;
  email: string;
  role: string;
  departmentId: number | null;
  departmentName?: string | null;
  permissions?: string[];
  roles?: Array<{
    id: number;
    code: string;
    name: string;
    enabled: boolean;
    builtIn: boolean;
    adminRole: boolean;
  }>;
  menus?: Array<{
    id: number;
    parentId?: number | null;
    code: string;
    name: string;
    type: 'menu' | 'page' | 'action';
    routeKey?: string | null;
    icon?: string | null;
    sortOrder: number;
    enabled: boolean;
    children?: ApiUser['menus'];
  }>;
  buttonPermissions?: string[];
};

type LoginResponse = {
  accessToken: string;
  expiresIn: number;
  user: ApiUser;
};

function normalizeUser(user: ApiUser): User {
  const role = user.role.toLowerCase() as User['role'];
  return {
    id: String(user.id),
    name: user.name,
    email: user.email,
    role,
    departmentId: user.departmentId == null ? '' : String(user.departmentId),
    departmentName: user.departmentName ?? undefined,
    permissions: (user.permissions ?? []) as PermissionAction[],
    roles: normalizeRoles(user.roles ?? []),
    menus: normalizeMenus(user.menus ?? []),
    buttonPermissions: user.buttonPermissions ?? [],
    avatar: user.name.slice(0, 1).toUpperCase(),
  };
}

function normalizeRoles(roles: ApiUser['roles']): RoleOption[] {
  return (roles ?? []).map((role) => ({
    id: String(role.id),
    code: role.code,
    name: role.name,
    enabled: role.enabled,
    builtIn: role.builtIn,
    adminRole: role.adminRole,
  }));
}

function normalizeMenus(menus: NonNullable<ApiUser['menus']>): SystemMenuNode[] {
  return menus.map((menu) => ({
    id: String(menu.id),
    parentId: menu.parentId == null ? undefined : String(menu.parentId),
    code: menu.code,
    name: menu.name,
    type: menu.type,
    routeKey: menu.routeKey ?? undefined,
    icon: menu.icon ?? undefined,
    sortOrder: menu.sortOrder,
    enabled: menu.enabled,
    children: normalizeMenus(menu.children ?? []),
  }));
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? {});
  headers.set('Accept', 'application/json');

  const token = getAuthToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!(init?.body instanceof FormData) && init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  let payload: ApiEnvelope<T> | null = null;
  try {
    payload = await parseJsonResponse<ApiEnvelope<T>>(response);
  } catch {
    payload = null;
  }
  if (response.status === 401) {
    clearAuthToken();
  }
  if (!response.ok || !payload || !payload.success) {
    throw new Error(payload?.message || `Request failed with status ${response.status}`);
  }
  return payload.data;
}

export async function loginWithPassword(username: string, password: string) {
  const data = await request<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setAuthToken(data.accessToken);
  return normalizeUser(data.user);
}

export async function fetchCurrentUser() {
  const data = await request<ApiUser>('/api/auth/me');
  return normalizeUser(data);
}

export async function logoutRequest() {
  try {
    await request<void>('/api/auth/logout', { method: 'POST' });
  } catch {
    // JWT 退出登录主要依赖前端清理本地令牌，这里忽略接口失败。
  } finally {
    clearAuthToken();
  }
}

export async function changePasswordRequest(currentPassword: string, newPassword: string, confirmPassword: string) {
  await request<void>('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({
      currentPassword,
      newPassword,
      confirmPassword,
    }),
  });
}
