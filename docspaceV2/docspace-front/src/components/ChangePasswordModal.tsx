/**
 * 修改密码弹窗，供已登录用户更新自己的登录密码。
 */
import React, { FormEvent, useState } from 'react';
import { KeyRound, LockKeyhole, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useToast } from '../contexts/ToastContext';
import { getErrorMessage } from '../lib/errors';
import { changePasswordRequest } from '../services/auth';

interface ChangePasswordModalProps {
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
}

export function ChangePasswordModal({ onClose, onSuccess }: ChangePasswordModalProps) {
  const { pushToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (newPassword !== confirmPassword) {
      pushToast({
        tone: 'error',
        title: '校验失败',
        description: '两次输入的新密码不一致。',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await changePasswordRequest(currentPassword, newPassword, confirmPassword);
      pushToast({
        tone: 'success',
        title: '密码修改成功',
        description: '请使用新密码重新登录。',
      });
      await onSuccess();
      onClose();
    } catch (error) {
      pushToast({
        tone: 'error',
        title: '密码修改失败',
        description: getErrorMessage(error, '请稍后重试。'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-50 p-3 text-blue-700">
              <KeyRound size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">修改密码</h2>
              <p className="text-sm text-slate-500">修改成功后会自动退出当前登录状态。</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-200">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6">
          <Field
            label="当前密码"
            type="password"
            value={currentPassword}
            onChange={setCurrentPassword}
            placeholder="请输入当前密码"
          />
          <Field
            label="新密码"
            type="password"
            value={newPassword}
            onChange={setNewPassword}
            placeholder="请输入新密码（至少 8 位）"
          />
          <Field
            label="确认新密码"
            type="password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="请再次输入新密码"
          />

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-100"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-blue-700 px-5 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60"
            >
              {isSubmitting ? '提交中...' : '确认修改'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <LockKeyhole size={18} className="text-slate-400" />
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
      </div>
    </label>
  );
}
