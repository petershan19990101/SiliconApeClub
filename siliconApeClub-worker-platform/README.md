# siliconApeClub-worker-platform

硅基猿猴俱乐部 AI 员工平台后端，负责客户端运行期 API、客户需求分组、聊天记录、组织关系、业务前台接待、员工派活、长任务恢复、Skill 加载、记忆维护与知识沉淀发起。

前端工程已拆分为根目录平级的 `siliconApeClub-worker-front`。客户端业务 API 只访问本服务的 `/api/worker-platform/**`，Knowledge Runtime、Task Memory、Retrieval、管理台后端都是服务端内部依赖。

## 本地启动

```powershell
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 3010
```

默认种子账号：

| 类型 | 账号 | 密码 |
| --- | --- | --- |
| 外部客户 | `customer` | `Customer@123` |
| 内部人员 | `internal` | `Internal@123` |
| 管理员 | `admin` | `Admin@123` |
