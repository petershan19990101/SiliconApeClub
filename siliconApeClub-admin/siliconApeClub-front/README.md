# 硅基猿猴俱乐部管理台前端

企业知识层、AI 员工和知识资产运营的统一管理台前端。

**Node 版本**：`18.20.4`（见仓库根目录与 `siliconApeClub-front/.nvmrc`）。

当前版本覆盖：

- 知识资产库、上传、解析校正、审核发布
- 权限管理、系统设置、全域检索
- Wiki 中心、岗位知识管理、AI 员工配置、知识运营健康、RAG 管理台
- API-only 模式运行，依赖 `siliconApeClub-server`；RAG 管理台通过管理台后端代理到 `retrieval-service`

## 启动

```bash
npm install
npm run dev
```

如需指定管理台后端地址：

```bash
VITE_API_BASE_URL=http://localhost:8080
```

## 常用命令

- `npm run dev`：本地开发
- `npm run typecheck`：类型检查
- `npm run build`：生产构建
- `npm run test:run`：运行测试

## 目录说明

- `src/components`：页面、弹窗和文档预览组件
- `src/components/knowledge`：知识层页面
- `src/components/library`：知识资产库拆分子组件
- `src/contexts`：用户、应用壳、Toast 状态
- `src/services`：HTTP 服务封装
- `src/lib`：格式、权限、上传格式等共享工具
