import {
  AiModelProfile,
  AiModelProfileTestResult,
  AdminDepartment,
  AdminRole,
  AdminUser,
  DepartmentDeleteCheck,
  ParseEngineBindingAdmin,
  RegisteredParseEngine,
  RoleOption,
  SystemMenuNode,
} from '../types';
import { getAuthToken } from '../lib/authStorage';
import { parseJsonResponse } from './json';

const env = import.meta.env as Record<string, string | undefined>;
const API_BASE_URL = env.VITE_API_BASE_URL ?? 'http://localhost:8080';

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
};

type ApiMenu = {
  id: number;
  parentId?: number | null;
  code: string;
  name: string;
  type: 'menu' | 'page' | 'action';
  routeKey?: string | null;
  icon?: string | null;
  sortOrder: number;
  enabled: boolean;
  children?: ApiMenu[];
};

type ApiRole = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  enabled: boolean;
  builtIn: boolean;
  adminRole: boolean;
  memberCount: number;
};

type ApiRoleOption = {
  id: number;
  code: string;
  name: string;
  enabled: boolean;
  builtIn: boolean;
  adminRole: boolean;
};

type ApiUser = {
  id: number;
  username: string;
  displayName: string;
  email: string;
  departmentId: number;
  departmentName?: string | null;
  enabled: boolean;
  primaryRoleCode: string;
  roles: ApiRoleOption[];
};

type ApiDepartment = {
  id: number;
  parentId?: number | null;
  name: string;
  children?: ApiDepartment[];
};

type ApiDepartmentDeleteCheck = {
  departmentId: number;
  departmentName: string;
  parentId?: number | null;
  parentName?: string | null;
  childDepartmentCount: number;
  userCount: number;
  folderCount: number;
  documentCount: number;
  topLevel: boolean;
};

type ApiRegisteredParseEngine = {
  code: string;
  name: string;
  description: string;
};

type ApiParseEngineBindingAdmin = {
  id: number;
  fileExtension: string;
  engineCode: string;
  engineName: string;
  defaultBinding: boolean;
  enabled: boolean;
  sortOrder: number;
};

type ApiAiModelProfile = {
  id: number;
  profileCode: string;
  profileName: string;
  provider: string;
  purpose: string;
  endpoint: string;
  apiKeyConfigured: boolean;
  apiKeyMasked?: string | null;
  modelName: string;
  dimensions?: number | null;
  timeoutSeconds: number;
  enabled: boolean;
  defaultProfile: boolean;
  fallbackEnabled: boolean;
  configJson?: string | null;
  updatedAt?: string | null;
};

type ApiAiModelProfileTestResult = {
  status: string;
  provider: string;
  purpose: string;
  modelName: string;
  realCall: boolean;
  fallbackUsed: boolean;
  message: string;
  embeddingDimensions?: number | null;
  sample?: string | null;
};

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

  const payload = await parseJsonResponse<ApiEnvelope<T>>(response);
  if (!response.ok || !payload || !payload.success) {
    throw new Error(payload?.message || `Request failed with status ${response.status}`);
  }
  return payload.data;
}

function normalizeMenu(menu: ApiMenu): SystemMenuNode {
  return {
    id: String(menu.id),
    parentId: menu.parentId == null ? undefined : String(menu.parentId),
    code: menu.code,
    name: menu.name,
    type: menu.type,
    routeKey: menu.routeKey ?? undefined,
    icon: menu.icon ?? undefined,
    sortOrder: menu.sortOrder,
    enabled: menu.enabled,
    children: (menu.children ?? []).map(normalizeMenu),
  };
}

function normalizeRoleOption(role: ApiRoleOption): RoleOption {
  return {
    id: String(role.id),
    code: role.code,
    name: role.name,
    enabled: role.enabled,
    builtIn: role.builtIn,
    adminRole: role.adminRole,
  };
}

function normalizeRole(role: ApiRole): AdminRole {
  return {
    id: String(role.id),
    code: role.code,
    name: role.name,
    description: role.description ?? undefined,
    enabled: role.enabled,
    builtIn: role.builtIn,
    adminRole: role.adminRole,
    memberCount: role.memberCount,
  };
}

function normalizeUser(user: ApiUser): AdminUser {
  return {
    id: String(user.id),
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    departmentId: String(user.departmentId),
    departmentName: user.departmentName ?? undefined,
    enabled: user.enabled,
    primaryRoleCode: user.primaryRoleCode,
    roles: user.roles.map(normalizeRoleOption),
  };
}

function normalizeDepartment(department: ApiDepartment): AdminDepartment {
  return {
    id: String(department.id),
    parentId: department.parentId == null ? undefined : String(department.parentId),
    name: department.name,
    children: (department.children ?? []).map(normalizeDepartment),
  };
}

function normalizeDepartmentDeleteCheck(payload: ApiDepartmentDeleteCheck): DepartmentDeleteCheck {
  return {
    departmentId: String(payload.departmentId),
    departmentName: payload.departmentName,
    parentId: payload.parentId == null ? undefined : String(payload.parentId),
    parentName: payload.parentName ?? undefined,
    childDepartmentCount: payload.childDepartmentCount,
    userCount: payload.userCount,
    folderCount: payload.folderCount,
    documentCount: payload.documentCount,
    topLevel: payload.topLevel,
  };
}

function normalizeRegisteredParseEngine(engine: ApiRegisteredParseEngine): RegisteredParseEngine {
  return {
    code: engine.code,
    name: engine.name,
    description: engine.description,
  };
}

function normalizeParseEngineBinding(binding: ApiParseEngineBindingAdmin): ParseEngineBindingAdmin {
  return {
    id: String(binding.id),
    fileExtension: binding.fileExtension,
    engineCode: binding.engineCode,
    engineName: binding.engineName,
    isDefault: binding.defaultBinding,
    enabled: binding.enabled,
    sortOrder: binding.sortOrder,
  };
}

function normalizeAiModelProfile(profile: ApiAiModelProfile): AiModelProfile {
  return {
    id: String(profile.id),
    profileCode: profile.profileCode,
    profileName: profile.profileName,
    provider: profile.provider,
    purpose: profile.purpose,
    endpoint: profile.endpoint,
    apiKeyConfigured: profile.apiKeyConfigured,
    apiKeyMasked: profile.apiKeyMasked ?? undefined,
    modelName: profile.modelName,
    dimensions: profile.dimensions ?? undefined,
    timeoutSeconds: profile.timeoutSeconds,
    enabled: profile.enabled,
    defaultProfile: profile.defaultProfile,
    fallbackEnabled: profile.fallbackEnabled,
    configJson: profile.configJson ?? undefined,
    updatedAt: profile.updatedAt ?? undefined,
  };
}

function normalizeAiModelProfileTestResult(result: ApiAiModelProfileTestResult): AiModelProfileTestResult {
  return {
    status: result.status,
    provider: result.provider,
    purpose: result.purpose,
    modelName: result.modelName,
    realCall: result.realCall,
    fallbackUsed: result.fallbackUsed,
    message: result.message,
    embeddingDimensions: result.embeddingDimensions ?? undefined,
    sample: result.sample ?? undefined,
  };
}

export const adminService = {
  async listMenus() {
    const data = await request<ApiMenu[]>('/api/admin/menus');
    return data.map((menu) => normalizeMenu({ ...menu, children: [] }));
  },
  async listMenuTree() {
    const data = await request<ApiMenu[]>('/api/admin/menus/tree');
    return data.map(normalizeMenu);
  },
  async createMenu(payload: {
    parentId?: string;
    code: string;
    name: string;
    type: 'menu' | 'page' | 'action';
    routeKey?: string;
    icon?: string;
    sortOrder: number;
    enabled: boolean;
  }) {
    const data = await request<ApiMenu>('/api/admin/menus', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        parentId: payload.parentId ? Number(payload.parentId) : null,
      }),
    });
    return normalizeMenu({ ...data, children: [] });
  },
  async updateMenu(id: string, payload: {
    parentId?: string;
    code: string;
    name: string;
    type: 'menu' | 'page' | 'action';
    routeKey?: string;
    icon?: string;
    sortOrder: number;
    enabled: boolean;
  }) {
    const data = await request<ApiMenu>(`/api/admin/menus/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        ...payload,
        parentId: payload.parentId ? Number(payload.parentId) : null,
      }),
    });
    return normalizeMenu({ ...data, children: [] });
  },
  async deleteMenu(id: string) {
    await request<void>(`/api/admin/menus/${id}`, { method: 'DELETE' });
  },
  async listRoles() {
    const data = await request<ApiRole[]>('/api/admin/roles');
    return data.map(normalizeRole);
  },
  async createRole(payload: {
    code: string;
    name: string;
    description?: string;
    enabled: boolean;
    adminRole: boolean;
  }) {
    const data = await request<ApiRole>('/api/admin/roles', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return normalizeRole(data);
  },
  async updateRole(id: string, payload: {
    code: string;
    name: string;
    description?: string;
    enabled: boolean;
    adminRole: boolean;
  }) {
    const data = await request<ApiRole>(`/api/admin/roles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return normalizeRole(data);
  },
  async deleteRole(id: string) {
    await request<void>(`/api/admin/roles/${id}`, { method: 'DELETE' });
  },
  async getRolePermissionIds(id: string) {
    return request<number[]>(`/api/admin/roles/${id}/permissions`);
  },
  async updateRolePermissionIds(id: string, menuIds: string[]) {
    await request<void>(`/api/admin/roles/${id}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ menuIds: menuIds.map((item) => Number(item)) }),
    });
  },
  async listUsers() {
    const data = await request<ApiUser[]>('/api/admin/users');
    return data.map(normalizeUser);
  },
  async createUser(payload: {
    username: string;
    displayName: string;
    email: string;
    departmentId: string;
    password?: string;
    enabled: boolean;
  }) {
    const data = await request<ApiUser>('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        departmentId: Number(payload.departmentId),
      }),
    });
    return normalizeUser(data);
  },
  async updateUser(id: string, payload: {
    username: string;
    displayName: string;
    email: string;
    departmentId: string;
    enabled: boolean;
  }) {
    const data = await request<ApiUser>(`/api/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        ...payload,
        departmentId: Number(payload.departmentId),
      }),
    });
    return normalizeUser(data);
  },
  async enableUser(id: string) {
    await request<void>(`/api/admin/users/${id}/enable`, { method: 'POST' });
  },
  async disableUser(id: string) {
    await request<void>(`/api/admin/users/${id}/disable`, { method: 'POST' });
  },
  async updateUserRoles(id: string, roleIds: string[]) {
    await request<void>(`/api/admin/users/${id}/roles`, {
      method: 'PUT',
      body: JSON.stringify({ roleIds: roleIds.map((item) => Number(item)) }),
    });
  },
  async resetPassword(id: string, newPassword: string) {
    await request<void>(`/api/admin/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    });
  },
  async listDepartments() {
    const data = await request<ApiDepartment[]>('/api/admin/departments');
    return data.map((department) => normalizeDepartment({ ...department, children: [] }));
  },
  async listDepartmentTree() {
    const data = await request<ApiDepartment[]>('/api/admin/departments/tree');
    return data.map(normalizeDepartment);
  },
  async createDepartment(payload: {
    name: string;
    parentId?: string;
  }) {
    const data = await request<ApiDepartment>('/api/admin/departments', {
      method: 'POST',
      body: JSON.stringify({
        name: payload.name,
        parentId: payload.parentId ? Number(payload.parentId) : null,
      }),
    });
    return normalizeDepartment({ ...data, children: [] });
  },
  async updateDepartment(id: string, payload: {
    name: string;
    parentId?: string;
  }) {
    const data = await request<ApiDepartment>(`/api/admin/departments/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: payload.name,
        parentId: payload.parentId ? Number(payload.parentId) : null,
      }),
    });
    return normalizeDepartment({ ...data, children: [] });
  },
  async getDepartmentDeleteCheck(id: string) {
    const data = await request<ApiDepartmentDeleteCheck>(`/api/admin/departments/${id}/delete-check`);
    return normalizeDepartmentDeleteCheck(data);
  },
  async deleteDepartment(id: string) {
    await request<void>(`/api/admin/departments/${id}`, { method: 'DELETE' });
  },
  async listRegisteredParseEngines() {
    const data = await request<ApiRegisteredParseEngine[]>('/api/admin/parse-engines/catalog');
    return data.map(normalizeRegisteredParseEngine);
  },
  async listParseEngineBindings() {
    const data = await request<ApiParseEngineBindingAdmin[]>('/api/admin/parse-engine-bindings');
    return data.map(normalizeParseEngineBinding);
  },
  async createParseEngineBinding(payload: {
    fileExtension: string;
    engineCode: string;
    isDefault: boolean;
    enabled: boolean;
    sortOrder: number;
  }) {
    const data = await request<ApiParseEngineBindingAdmin>('/api/admin/parse-engine-bindings', {
      method: 'POST',
      body: JSON.stringify({
        fileExtension: payload.fileExtension,
        engineCode: payload.engineCode,
        defaultBinding: payload.isDefault,
        enabled: payload.enabled,
        sortOrder: payload.sortOrder,
      }),
    });
    return normalizeParseEngineBinding(data);
  },
  async updateParseEngineBinding(id: string, payload: {
    fileExtension: string;
    engineCode: string;
    isDefault: boolean;
    enabled: boolean;
    sortOrder: number;
  }) {
    const data = await request<ApiParseEngineBindingAdmin>(`/api/admin/parse-engine-bindings/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        fileExtension: payload.fileExtension,
        engineCode: payload.engineCode,
        defaultBinding: payload.isDefault,
        enabled: payload.enabled,
        sortOrder: payload.sortOrder,
      }),
    });
    return normalizeParseEngineBinding(data);
  },
  async deleteParseEngineBinding(id: string) {
    await request<void>(`/api/admin/parse-engine-bindings/${id}`, { method: 'DELETE' });
  },
  async listAiModelProfiles() {
    const data = await request<ApiAiModelProfile[]>('/api/admin/ai-model-profiles');
    return data.map(normalizeAiModelProfile);
  },
  async updateAiModelProfile(id: string, payload: {
    profileName: string;
    provider: string;
    purpose: string;
    endpoint: string;
    apiKey?: string | null;
    modelName: string;
    dimensions?: number | null;
    timeoutSeconds: number;
    enabled: boolean;
    defaultProfile: boolean;
    fallbackEnabled: boolean;
    configJson?: string;
  }) {
    const data = await request<ApiAiModelProfile>(`/api/admin/ai-model-profiles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return normalizeAiModelProfile(data);
  },
  async testAiModelProfile(id: string) {
    const data = await request<ApiAiModelProfileTestResult>(`/api/admin/ai-model-profiles/${id}/test`, {
      method: 'POST',
    });
    return normalizeAiModelProfileTestResult(data);
  },
};
