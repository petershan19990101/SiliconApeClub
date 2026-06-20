# Design Log

> 本文件用于持续沉淀“硅基猿候俱乐部 / DocSpace Knowledge Layer”的设计决策、产品方案、技术架构和实施记录。后续新讨论继续按日期追加。

## 2026-06-20

### 1. 项目定位

硅基猿候俱乐部的核心目标不是搭建一个大而空的多 Agent 聊天室，而是嵌入公司现有组织，以岗位为单位逐步替换或增强人力组织能力。

DocSpace Knowledge Layer 被定位为企业知识层与 AI 员工核心记忆层：

- 人类管理层：DocSpace，负责文档接入、权限、版本、审核、审计和知识运营。
- LLM Wiki 层：负责人机共读的知识组织、页面、模板、结构化表达和关系沉淀。
- RAG Memory 层：负责 AI 员工可调用的 chunk、embedding、权限过滤、检索、rerank、引用追溯和任务回放。

结论：

```text
LLM Wiki 是知识本体。
RAG 是 AI 员工调用知识的派生索引。
二者必须通过同步账本、版本、权限和引用日志保持一致。
```

### 2. 核心产品设计

产品 PRD 已输出到：

- [PRD.md](C:/Users/16952/Documents/x-worker/PRD.md)

核心范围：

- 企业知识层整体产品设计。
- 人类管理层 DocSpace。
- LLM Wiki 层。
- AI 员工 RAG Memory 层。
- 知识管理员。
- 每日 30 分钟知识静默巡检窗口。
- 知识健康报告。
- 知识权限。
- 岗位知识包。
- 知识热度。
- Wiki 与 RAG 一致性。
- 数据模型和 MVP 分期。

关键产品原则：

- 文档只是知识来源，不等于知识本体。
- Wiki 页面和知识对象是人机共读的知识表达。
- RAG chunk、embedding、关键词索引是 Wiki/文档版本的派生物。
- AI 员工使用知识必须带来源、版本、权限命中原因和引用日志。
- 知识库要长期运营，不是一轮导入工程。

### 3. 系统架构设计

系统架构设计已输出到：

- [ARCHITECTURE.md](C:/Users/16952/Documents/x-worker/ARCHITECTURE.md)

核心架构：

```text
用户与 AI 员工
  ↓
统一入口层
  Web Portal / Admin Console / AI Memory API / OpenAPI / Webhook
  ↓
访问控制层
  API Gateway / Auth / IAM / RBAC / ABAC / AI Identity
  ↓
业务服务层
  Doc Service
  Wiki Service
  Knowledge Pipeline Service
  Knowledge Index Service
  Retrieval Service
  Position Package Service
  Knowledge Health Service
  Audit Trace Service
  Notification Service
  ↓
数据与索引层
  PostgreSQL / pgvector
  Redis
  MinIO
  RocketMQ
  OpenSearch optional
  Milvus/Qdrant optional
  ↓
AI 能力层
  LLM Provider
  Embedding Provider
  Rerank Provider
  OCR / Parser / Extractor
```

MVP 服务划分：

- `docspace-server`：模块化单体，承载 Doc、Auth/IAM、Wiki、Knowledge Pipeline、Knowledge Index、Position Package、Knowledge Health、Audit Trace。
- `retrieval-service`：独立 FastAPI 服务，承载 RAG 检索、pgvector 查询、百炼 embedding/rerank、权限强校验、citation log。
- `docspace-front`：前端统一入口。
- `docker-compose.yml`：统一编排 PostgreSQL/pgvector、Redis、RocketMQ、MinIO、docspace-server、retrieval-service。

技术选型：

- 前端：React + Vite + TypeScript。
- 后端：Java 8 + Spring Boot 2.2.x，后续建议升级 Java 17 + Spring Boot 3。
- 数据库：PostgreSQL + pgvector。
- 对象存储：MinIO。
- 缓存：Redis。
- 消息队列：RocketMQ。
- 检索服务：Python 3.11 + FastAPI。
- 模型供应商：阿里云百炼 / Qwen。
- Embedding：`text-embedding-v4`，默认 1024 维。
- Rerank：`qwen3-rerank`。
- Chat：`qwen-plus`。

### 4. MVP 实施方案

实施计划已确认：

```text
项目形态：现有 docspaceV2 改造 + 新增 retrieval-service
数据库：PostgreSQL + pgvector
交付深度：完整 MVP
模型厂商：阿里云百炼 / Qwen
检索：PostgreSQL + pgvector + qwen3-rerank
```

新增后端模块：

- `wiki`：页面、模板、版本、发布、归档、RAG 同步状态。
- `knowledge`：chunk、sync job、index record、ACL policy、引用日志。
- `position`：岗位知识包、AI 员工绑定、默认检索范围。
- `health`：知识健康问题、日报、静默巡检窗口。
- `ai`：AI 员工身份管理。

新增前端页面：

- 知识 Wiki。
- 岗位知识包。
- 知识健康。
- RAG 调试台。
- AI 员工。

新增 retrieval-service API：

```http
GET  /api/retrieval/health
POST /api/retrieval/search
POST /api/retrieval/debug
```

新增 docspace-server API：

```http
GET    /api/wiki/pages
POST   /api/wiki/pages
GET    /api/wiki/pages/{id}
PUT    /api/wiki/pages/{id}
POST   /api/wiki/pages/{id}/publish
POST   /api/wiki/pages/{id}/archive
GET    /api/wiki/pages/{id}/versions
GET    /api/wiki/pages/{id}/sync-status

POST   /api/knowledge/sync-jobs
GET    /api/knowledge/sync-jobs/{id}
POST   /api/knowledge/chunks/{id}/permission-check
GET    /api/knowledge/citations

GET    /api/position-packages
POST   /api/position-packages
GET    /api/position-packages/{id}
PUT    /api/position-packages/{id}
POST   /api/position-packages/{id}/publish
PUT    /api/position-packages/{id}/items

GET    /api/admin/ai-employees
POST   /api/admin/ai-employees
PUT    /api/admin/ai-employees/{id}
PUT    /api/admin/ai-employees/{id}/position-packages

GET    /api/knowledge-health/issues
PUT    /api/knowledge-health/issues/{id}
GET    /api/knowledge-health/reports
POST   /api/knowledge-health/reports/generate
GET    /api/knowledge-health/maintenance-window
POST   /api/knowledge-health/maintenance-window/start
POST   /api/knowledge-health/maintenance-window/end
```

### 5. 当前落地状态

已在 `docspaceV2` 中完成主体实现：

- 默认配置迁移到 PostgreSQL。
- 新增 `db/migration-postgres`。
- 新增 pgvector 表结构和知识层核心表。
- 新增根级 `docker-compose.yml`。
- 新增 `docspace-server/Dockerfile`。
- 新增 `retrieval-service` FastAPI 项目。
- 新增 Wiki / Knowledge / Position / Health / AI 后端模块。
- 原有文档 `rag-sync` 改为创建知识同步任务。
- 文档发布后会尝试生成 Wiki 草稿。
- Wiki 发布后会生成 chunk、写入索引账本并更新同步状态。
- retrieval-service 支持本地 hash embedding fallback；有百炼 key 时可调用百炼。
- 前端新增知识层菜单与页面。
- 前端 README 冲突标记已清理。

验证状态：

- 前端 TypeScript 检查通过。
- retrieval-service Python 语法检查通过。
- 后端 Maven 测试被本机 Maven Central PKIX 证书链问题阻塞，无法下载 Spring Boot Maven 插件。
- retrieval-service pytest 被本机 PyPI SSL 证书问题阻塞，无法安装依赖。

### 6. 待办事项

优先级 P0：

- 修复本机或 CI 环境的 Maven/PyPI SSL 证书问题。
- 跑通 `docspace-server` Maven 测试和打包。
- 使用 PostgreSQL 空库验证 Flyway 全量初始化。
- 使用 `docker compose up -d` 验证全服务启动。
- 端到端验证：创建 Wiki -> 发布 -> 生成 chunk -> RAG 调试召回 -> citation log 回写。

优先级 P1：

- 将百炼真实 embedding/rerank 调用接入联调环境。
- 增加知识同步任务重试和异步 Worker。
- 补充更完整的岗位知识包 item 绑定 UI。
- 强化权限模型：AI_EMPLOYEE、AI_ROLE、POSITION、PROJECT 的 ABAC 规则。
- 增加健康报告更多指标：高频失败知识、过期知识、冲突知识。

优先级 P2：

- Java 8 / Spring Boot 2.2.x 升级到 Java 17 / Spring Boot 3。
- 增加 OpenSearch。
- 增加知识图谱能力。
- 增加企业系统连接器。
- 增加多 Agent 任务执行层。
