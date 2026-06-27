# DocSpace Frontend

企业知识层与智能文档管理前端。

**Node 版本**：`18.20.4`（见仓库根目录与 `docspace-front/.nvmrc`）。

当前版本覆盖：

- 文档库、上传、解析校正、审核发布
- 权限管理、系统设置、全局搜索
- 知识 Wiki、岗位知识包、AI 员工、知识健康、RAG 调试台
- API-only 模式运行，依赖 `docspace-server` 和 `retrieval-service`

## 启动

```bash
npm install
npm run dev
```

如需指定后端与检索服务地址：

```bash
VITE_API_BASE_URL=http://localhost:8080
VITE_RETRIEVAL_BASE_URL=http://localhost:8090
```

## 常用命令

- `npm run dev`：本地开发
- `npm run typecheck`：类型检查
- `npm run build`：生产构建
- `npm run test:run`：运行测试

## 目录说明

- `src/components`：页面、弹窗和文档预览组件
- `src/components/knowledge`：知识层页面
- `src/components/library`：文档库拆分子组件
- `src/contexts`：用户、应用壳、Toast 状态
- `src/services`：HTTP 服务封装
- `src/lib`：格式、权限、上传格式等共享工具
