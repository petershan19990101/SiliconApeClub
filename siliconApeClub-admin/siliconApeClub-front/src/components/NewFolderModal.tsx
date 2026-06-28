/**
 * 新建文件夹弹窗，支持为目录选择归属部门，并显式展示父文件夹。
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Building2, ChevronDown, Folder as FolderIcon, FolderPlus, X } from 'lucide-react';
import { motion } from 'motion/react';
import { Department, Folder } from '../types';
import { documentRepository } from '../services';
import { useToast } from '../contexts/ToastContext';
import { useUser } from '../contexts/UserContext';
import { getErrorMessage } from '../lib/errors';

interface NewFolderModalProps {
  parentFolder?: Folder | null;
  onClose: () => void;
  onCreated: () => void;
}

type DepartmentOption = Department & { depth: number };

export function NewFolderModal({ parentFolder, onClose, onCreated }: NewFolderModalProps) {
  const { currentUser } = useUser();
  const { pushToast } = useToast();
  const [folderName, setFolderName] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState(parentFolder?.departmentId ?? currentUser?.departmentId ?? '');
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(false);
  const [departmentLoadFailed, setDepartmentLoadFailed] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const fallbackDepartmentId = parentFolder?.departmentId ?? currentUser?.departmentId ?? '';
  const fallbackDepartments = useMemo<Department[]>(() => fallbackDepartmentId
      ? [{
        id: fallbackDepartmentId,
        name: currentUser?.departmentName ?? fallbackDepartmentId,
        parentId: undefined,
      }]
      : [], [currentUser?.departmentName, fallbackDepartmentId]);
  const departmentOptions = useMemo(() => {
    const options = buildDepartmentOptions(
      departments.length > 0 ? departments : fallbackDepartments,
      parentFolder?.departmentId
    );
    return options.length > 0 ? options : buildDepartmentOptions(fallbackDepartments, parentFolder?.departmentId);
  }, [departments, fallbackDepartments, parentFolder?.departmentId]);
  const parentFolderName = parentFolder?.name ?? '文档管理根目录';
  const departmentHint = parentFolder ? '可选择父部门或其下级部门。' : '可选择组织内任一部门。';

  useEffect(() => {
    let cancelled = false;
    setIsLoadingDepartments(true);
    setDepartmentLoadFailed(false);

    documentRepository.getDepartments()
      .then((nextDepartments) => {
        if (!cancelled) {
          setDepartments(nextDepartments);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDepartments([]);
          setDepartmentLoadFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingDepartments(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!currentUser?.departmentId || departmentOptions.length === 0) {
      return;
    }

    setSelectedDepartmentId((current) => {
      if (departmentOptions.some((department) => department.id === current)) {
        return current;
      }
      if (departmentOptions.some((department) => department.id === currentUser.departmentId)) {
        return currentUser.departmentId;
      }
      return departmentOptions[0].id;
    });
  }, [currentUser?.departmentId, departmentOptions]);

  if (!currentUser) {
    return null;
  }

  const handleCreate = async () => {
    const trimmedName = folderName.trim();
    if (!trimmedName || !selectedDepartmentId) {
      return;
    }

    setIsCreating(true);

    try {
      await documentRepository.createFolder({
        name: trimmedName,
        departmentId: selectedDepartmentId,
        parentId: parentFolder?.id,
        creator: currentUser,
      });
      pushToast({
        tone: 'success',
        title: '文件夹已创建',
        description: `“${trimmedName}” 已加入当前目录。`,
      });
      onCreated();
      onClose();
    } catch (caughtError) {
      pushToast({
        tone: 'error',
        title: '创建失败',
        description: getErrorMessage(caughtError, '文件夹创建失败'),
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="flex w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-8 py-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-700 text-white shadow-lg shadow-blue-700/20">
              <FolderPlus size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">新建文件夹</h2>
              <p className="text-sm text-slate-500">选择归属部门后，文件夹会挂载到当前父文件夹下。</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-200">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5 p-8">
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">文件夹名称</label>
            <div className="relative">
              <FolderIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                autoFocus
                value={folderName}
                onChange={(event) => setFolderName(event.target.value)}
                placeholder="输入文件夹名称..."
                className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-4 text-sm outline-none transition focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">所属部门</label>
            <div className="relative">
              <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <select
                value={selectedDepartmentId}
                onChange={(event) => setSelectedDepartmentId(event.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-10 text-sm text-slate-700 outline-none transition focus:ring-2 focus:ring-blue-100"
              >
                {departmentOptions.map((department) => (
                  <option key={department.id} value={department.id}>
                    {formatDepartmentOption(department)}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {departmentLoadFailed ? '部门列表读取失败，暂用当前部门。' : isLoadingDepartments ? '正在读取部门层级...' : departmentHint}
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">父文件夹</label>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <FolderIcon size={18} className="text-slate-400" />
              <span>{parentFolderName}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-8 py-4">
          <button onClick={onClose} className="rounded-xl px-5 py-2.5 font-bold text-slate-600 transition hover:bg-slate-200">
            取消
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating || !folderName.trim() || !selectedDepartmentId}
            className="rounded-xl bg-blue-700 px-6 py-2.5 font-bold text-white shadow-lg shadow-blue-700/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isCreating ? '创建中...' : '创建文件夹'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function buildDepartmentOptions(departments: Department[], rootDepartmentId?: string): DepartmentOption[] {
  const byId = new Map(departments.map((department) => [department.id, department]));
  const childrenByParent = new Map<string | undefined, Department[]>();
  departments.forEach((department) => {
    const siblings = childrenByParent.get(department.parentId) ?? [];
    siblings.push(department);
    childrenByParent.set(department.parentId, siblings);
  });

  const result: DepartmentOption[] = [];
  const visited = new Set<string>();
  const walk = (department: Department, depth: number) => {
    if (visited.has(department.id)) {
      return;
    }
    visited.add(department.id);
    result.push({ ...department, depth });
    sortDepartments(childrenByParent.get(department.id) ?? []).forEach((child) => walk(child, depth + 1));
  };

  if (rootDepartmentId) {
    const root = byId.get(rootDepartmentId);
    if (root) {
      walk(root, 0);
    }
    return result;
  }

  sortDepartments(childrenByParent.get(undefined) ?? []).forEach((department) => walk(department, 0));
  sortDepartments(departments.filter((department) => !visited.has(department.id))).forEach((department) => walk(department, 0));
  return result;
}

function sortDepartments(departments: Department[]) {
  return [...departments].sort((left, right) => {
    const leftId = Number(left.id);
    const rightId = Number(right.id);
    if (!Number.isNaN(leftId) && !Number.isNaN(rightId) && leftId !== rightId) {
      return leftId - rightId;
    }
    return left.name.localeCompare(right.name);
  });
}

function formatDepartmentOption(department: DepartmentOption) {
  return `${'　'.repeat(department.depth)}${department.depth > 0 ? '└ ' : ''}${department.name}`;
}
