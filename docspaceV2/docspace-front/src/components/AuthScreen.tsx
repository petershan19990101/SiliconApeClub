/**
 * 登录页组件，负责账号密码登录和演示账号提示。
 */
import React, { FormEvent, useState } from 'react';
import { LockKeyhole, UserRound } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { useToast } from '../contexts/ToastContext';
import { getErrorMessage } from '../lib/errors';

export function AuthScreen() {
  const { login, isLoading } = useUser();
  const { pushToast } = useToast();
  const [username, setUsername] = useState('zhangsan');
  const [password, setPassword] = useState('Admin@123');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      await login(username.trim(), password);
      pushToast({
        tone: 'success',
        title: '登录成功',
        description: '欢迎回到 DocSpace。',
      });
    } catch (error) {
      pushToast({
        tone: 'error',
        title: '登录失败',
        description: getErrorMessage(error, '请检查用户名和密码。'),
      });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.16),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.14),transparent_22%),#f3f7fb] px-6 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[40px] border border-white/70 bg-white/90 shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur lg:grid-cols-[1.1fr_0.9fr]">
        <section className="bg-slate-950 px-10 py-12 text-white">
          <div className="mb-10 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-2xl font-black">D</div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">DocSpace</h1>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Knowledge Flow</p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.3em] text-blue-300">登录系统</p>
              <h2 className="mt-4 text-4xl font-black leading-tight">智能文档管理与 RAG 知识库</h2>
              <p className="mt-4 max-w-md text-sm leading-7 text-slate-300">
                登录后即可查看工作台、文档库、审核流转和修订草稿，全流程都基于当前账号身份与权限控制。
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <CredentialCard title="张三（管理员）" username="zhangsan" password="Admin@123" />
              <CredentialCard title="李四（普通成员）" username="lisi" password="Member@123" />
            </div>
          </div>
        </section>

        <section className="px-8 py-12 sm:px-12">
          <div className="max-w-md">
            <p className="text-sm font-black uppercase tracking-[0.3em] text-blue-600">身份验证</p>
            <h3 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">登录到工作台</h3>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              请输入系统账号密码。退出登录后会清除本地 token，下次访问将重新进入登录页。
            </p>

            <form onSubmit={handleSubmit} className="mt-10 space-y-5">
              <label className="block space-y-2">
                <span className="text-sm font-bold text-slate-700">用户名</span>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <UserRound size={18} className="text-slate-400" />
                  <input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="请输入用户名"
                    className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                  />
                </div>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-bold text-slate-700">密码</span>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <LockKeyhole size={18} className="text-slate-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="请输入密码"
                    className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                  />
                </div>
              </label>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-2xl bg-blue-700 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-700/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? '登录中...' : '登录'}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}

function CredentialCard({ title, username, password }: { title: string; username: string; password: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
      <p className="text-sm font-bold text-white">{title}</p>
      <p className="mt-3 text-xs text-slate-300">账号：{username}</p>
      <p className="mt-1 text-xs text-slate-300">密码：{password}</p>
    </div>
  );
}
