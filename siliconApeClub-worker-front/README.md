# siliconApeClub-worker-front

硅基猿猴俱乐部 AI 员工平台前端，负责客户需求工作台、业务前台聊天、多模态 block 渲染、组织员工视图和任务账本展示。

前端在 Docker 中由 Nginx 托管，并将 `/api/worker-platform/**` 代理到后端 `siliconApeClub-worker-platform`。浏览器不直连 Knowledge Runtime、Task Memory、Retrieval。

## 本地开发

```powershell
npm install
npm run dev
```

开发服务端口为 `5174`，Vite 会把 `/api/worker-platform` 代理到 `http://localhost:3010`。

## Docker

```powershell
docker compose --profile app build siliconapeclub-worker-front
docker compose --profile app up -d siliconapeclub-worker-front
```

Docker 入口为 `http://localhost:3011`。
