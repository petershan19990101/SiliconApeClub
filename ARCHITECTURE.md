# 企业知识层系统架构设计

所属平台：硅基猿猴俱乐部  
关联产品：Silicon Ape Club Knowledge Layer  
版本：v0.1  
状态：架构讨论稿  
日期：2026-06-20

## 1. 架构目标

企业知识层的目标是为人类员工、LLM Wiki 和 AI 员工 RAG Memory 提供统一、可信、可运维、可扩展的知识基础设施。

本架构设计覆盖：

- 系统总体架构
- 微服务结构
- 技术选型
- 数据与索引架构
- AI 知识检索架构
- 部署拓扑
- 最低硬件要求
- 硬件成本估算
- 运维方案

## 2. 设计原则

### 2.1 先模块化，后微服务化

MVP 阶段不建议一开始拆成大量独立微服务，否则交付成本、联调成本和运维复杂度会过高。

建议：

```text
MVP：模块化单体 + 异步 Worker + 独立检索服务
试点：核心服务拆分
生产：微服务化 + 高可用 + 独立扩缩容
```

模块边界必须按微服务标准设计，代码、数据模型和事件都要避免强耦合，后续可以平滑拆分。

### 2.2 Wiki 是知识源头，RAG 是派生索引

LLM Wiki 页面、知识对象和文档版本是知识事实源。RAG chunk、embedding、关键词索引都是派生物。

任何 AI 员工使用的知识都必须能追溯回：

- Wiki 页面
- 页面版本
- 文档来源
- chunk
- 索引版本
- 权限策略
- 引用日志

### 2.3 权限实时生效，索引异步刷新

权限不能依赖更新每一个 chunk 才生效。

原则：

- 用户离职、禁用、调岗必须在身份权限服务即时生效。
- chunk 保存 ACL 引用、ACL 版本和稳定权限标签。
- 检索前做预过滤。
- 召回后做权限强校验。
- 索引中的冗余权限只作为缓存，不作为最终事实源。

### 2.4 AI 可解释优先于黑盒效果

AI 员工的每次检索和引用都必须可回放。

必须记录：

- 谁检索
- 为哪个任务检索
- query 是什么
- 召回了哪些 chunk
- 为什么选中
- 引用了哪个版本
- 是否命中最新知识
- 是否通过权限校验
- 输出是否被采纳

### 2.5 AI 员工通过运行时接口使用知识

知识层不能只暴露后台管理 API。AI 员工必须通过 Knowledge Runtime API 使用知识，避免直接耦合 Wiki 管理接口、RAG 内部索引或数据库。

运行时接口负责：

- 加载 AI 员工身份、岗位、权限和任务上下文。
- 加载岗位知识管理 runtime profile、must-read Wiki 和默认检索范围。岗位知识管理以 Wiki 页面集合为源头，不另造脱离 Wiki 的知识副本。
- 提供受权限控制的 Wiki 结构化读取能力。
- 提供 RAG 检索、debug、citation log 写入能力。
- 接收任务记忆、知识反馈和 Wiki proposal。
- 保证 AI 只能提交草稿或提案，不能绕过审核直接发布正式 Wiki。

### 2.6 最低硬件不绑定本地大模型

最低可用部署默认使用外部 LLM、Embedding、Rerank API。GPU 只在以下场景成为硬需求：

- 本地 embedding
- 本地 rerank
- 本地小模型摘要/抽取
- 私有化大模型推理

## 3. 总体架构

```text
用户与 AI 员工
  人类员工 / 知识管理员 / 部门知识负责人 / AI 员工 / AI 员工管理员
      ↓
统一入口层
  Web Portal / Admin Console / Knowledge Runtime API / AI Memory API / OpenAPI / Webhook
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
  Knowledge Runtime Service
  Task Memory Service
  Position Knowledge Service
  Knowledge Health Service
  Audit Trace Service
  Notification Service
      ↓
数据与索引层
  PostgreSQL / pgvector
  OpenSearch
  Redis
  MinIO
  RocketMQ
  Optional: Milvus / Qdrant / Neo4j
      ↓
AI 能力层
  LLM Provider
  Embedding Provider
  Rerank Provider
  OCR / Parser / Extractor
```

## 4. 微服务结构

### 4.1 MVP 逻辑服务

MVP 阶段建议物理上先合并部署为 3 到 5 个进程，逻辑上按以下服务划分。

| 服务 | MVP 物理形态 | 主要职责 | 是否建议独立库 |
| --- | --- | --- | --- |
| API Gateway | 可与后端合并 | 路由、鉴权入口、限流、审计入口 | 否 |
| Auth & IAM Service | 可与后端合并 | 用户、角色、部门、岗位、AI 员工身份、权限策略 | 可共享主库 |
| Doc Service | 保留原文档治理能力，运行于 `siliconApeClub-server` | 文档上传、目录、版本、解析产物、源文件管理 | 可共享主库 |
| Wiki Service | 新增模块 | Wiki 页面、模板、版本、关系、人机共读知识 | 可共享主库 |
| Knowledge Pipeline Worker | 独立 Worker | 清洗、切片、摘要、标签、实体抽取、embedding、索引任务 | 共享主库 |
| Knowledge Index Service | 可与 Worker 合并 | 索引账本、索引状态、重试、回滚 | 共享主库 |
| Retrieval Service | 建议独立 | 混合检索、权限预过滤、rerank、召回后强校验、引用结果 | 可独立服务 |
| Knowledge Runtime Service | 可与后端合并，接口边界独立 | AI 员工运行时上下文、Wiki 结构化读取、岗位 profile、调用编排 | 共享主库 |
| Task Memory Service | 可与 Audit 合并 | AI 任务记忆、citation 关联、沉淀候选、Wiki proposal 关联 | 共享主库 |
| Position Knowledge Service | 可与 Wiki 合并 | 基于 Wiki 的岗位知识管理、AI 员工绑定、默认检索范围、审核发布 | 共享主库 |
| Knowledge Health Service | 可与 Worker 合并 | 冲突检测、过期检测、热度统计、健康报告 | 共享主库 |
| Audit Trace Service | 可与后端合并 | 操作审计、AI 引用日志、检索回放日志 | 共享主库，日志可外置 |
| Notification Service | 可与后端合并 | 巡检通知、审核通知、同步失败通知 | 共享主库 |

当前 MVP 的前端入口不再定位为单一文档管理系统，而是“硅基猿猴俱乐部管理台”。管理台承载知识资产、Wiki 中心、RAG 管理台、AI 员工配置、岗位知识管理、权限与知识健康运营。`siliconApeClub-front` 作为静态资源容器部署，`siliconApeClub-server` 继续作为管理台后端与 API Gateway 的合并形态。

MVP 当前物理进程：

| 物理进程 | 承载逻辑服务 |
| --- | --- |
| `siliconApeClub-front` | 硅基猿猴俱乐部管理台静态入口 |
| `siliconApeClub-server` | API Gateway、Auth & IAM、Doc、Wiki Center、RAG Management、Position Knowledge、Knowledge Health、Audit Trace、Notification、后台管理型 Pipeline 入口 |
| `knowledge-pipeline-worker` | 独立文档到 LLM Wiki 流水线 Worker |
| `retrieval-service` | Retrieval Service，兼具独立 Knowledge Index Worker 能力 |
| `knowledge-runtime-service` | AI 员工 runtime context、AI 可读 Wiki、Wiki proposal |
| `task-memory-service` | AI 任务记忆与 Wiki proposal 沉淀 |

当前工程目录形态：

```text
siliconApeClub-admin/
  siliconApeClub-front/
  siliconApeClub-server/
retrieval-service/
knowledge-pipeline-worker/
knowledge-runtime-service/
task-memory-service/

planned:
  siliconApeClub-worker-platform/
```

`siliconApeClub-admin` 定位为管理平台，服务业务人员、知识管理员、测试和运营同学；后续新增的 `siliconApeClub-worker-platform` 定位为硅基俱乐部员工平台，对外提供 AI 员工服务能力、任务入口与运行期交互能力。两者共用知识层事实源，但前者负责“管理和治理”，后者负责“调用和服务”。

### 4.2 目标态微服务

生产规模扩大后，建议拆为：

```text
gateway-service
identity-service
doc-service
wiki-service
knowledge-pipeline-service
knowledge-index-service
retrieval-service
knowledge-runtime-service
task-memory-service
position-package-service
knowledge-health-service
audit-trace-service
notification-service
admin-service
```

### 4.3 服务职责详情

#### gateway-service

职责：

- API 路由
- JWT 校验
- 统一限流
- 请求日志
- CORS
- 灰度发布入口

技术建议：

- MVP：Spring Cloud Gateway 或 Nginx
- 生产：Spring Cloud Gateway / Kong / APISIX

#### identity-service

职责：

- 人类用户身份
- AI 员工身份
- 角色、部门、岗位
- RBAC + ABAC 权限
- 离职、禁用、调岗即时生效
- token 与 session 管理

关键能力：

- `principal_type = USER / AI_EMPLOYEE / ROLE / DEPARTMENT / POSITION / PROJECT`
- 支持权限策略版本号
- 支持 AI 员工专属权限边界

#### doc-service

职责：

- 文档上传
- 源文件存储
- 文档版本
- 文档解析
- 解析产物
- 人工校正
- 文档审核发布

说明：

现有 siliconApeClub-admin 的文档管理能力可作为该服务的基础。

#### wiki-service

职责：

- Wiki 页面
- 页面模板
- 页面版本
- 页面关系
- 页面评论
- 页面 AI 可用状态
- 页面到 RAG 索引状态映射
- Wiki 中心结构分组：支持按部门、页面类型、状态聚合页面。
- Wiki 权限可视化：展示 ACL 策略名称、密级、授权绑定数量，并与 RAG 管理台联动。
- Wiki 轻量关系图谱：基于页面上下游关系展示引用、依赖、相关、替代、重复关系。

关键模型：

- `ks_wiki_page`
- `ks_wiki_page_version`
- `ks_wiki_relation`
- `ks_acl_policy`
- `ks_acl_binding`
- `ks_chunk`

MVP 管理端接口：

```http
GET    /api/wiki/structure?groupBy=department,pageType,status
GET    /api/wiki/pages
GET    /api/wiki/pages/{id}
POST   /api/wiki/pages
PUT    /api/wiki/pages/{id}
POST   /api/wiki/pages/{id}/publish
POST   /api/wiki/pages/{id}/archive
DELETE /api/wiki/pages/{id}

GET    /api/wiki/pages/{id}/relations
POST   /api/wiki/pages/{id}/relations
DELETE /api/wiki/pages/{id}/relations/{relationId}
```

关系图谱第一阶段不引入 Neo4j 等图数据库，先由 PostgreSQL `ks_wiki_relation` 承载轻量网络。后续当出现自动实体抽取、跨页面冲突检测、路径分析和社区发现需求时，再评估 AntV G6/Cytoscape 前端可视化与图数据库拆分。

#### knowledge-pipeline-service

职责：

- 文档清洗
- Markdown 标准化
- 语义切片
- 摘要
- 标签
- 实体抽取
- 关系抽取
- embedding 调用
- 质量检查
- 发布索引任务

技术建议：

- MVP：Java Worker + Python Worker 混合
- Java 负责业务编排
- Python 负责 NLP、OCR、模型调用、复杂解析

#### knowledge-index-service

职责：

- 维护索引账本
- 管理 chunk 状态
- 管理 embedding 版本
- 管理索引版本
- 索引失败重试
- 索引回滚
- 索引水位监控

关键模型：

- `knowledge_chunk`
- `knowledge_index_record`
- `knowledge_sync_job`

#### retrieval-service

职责：

- 接收 AI 员工检索请求
- 解析 actor 身份和任务上下文
- 权限预过滤
- 关键词召回
- 向量召回
- 结构化过滤
- rerank
- 召回后权限强校验
- 返回带来源、版本、分数、解释的结果
- 记录 citation log

建议独立部署原因：

- 与 AI 员工交互频率高
- 性能要求不同于后台管理
- 后续需要独立扩容
- 需要接入多种向量库和 rerank 模型

#### knowledge-runtime-service

职责：

- 接收 AI 员工任务启动请求
- 聚合 AI 身份、岗位、部门、项目、任务上下文
- 加载岗位知识 runtime profile
- 加载 must-read Wiki 和默认检索 scope
- 暴露 AI 可读 Wiki 结构化内容
- 编排 RAG 检索请求
- 写入 citation log
- 限制 AI 员工只能提交反馈、草稿和 proposal

MVP 形态：

- 物理上可与 `siliconApeClub-server` 合并部署。
- 代码上建议保持独立 controller/service/package。
- 对 AI 员工暴露稳定 API，避免直接调用后台管理接口。

关键模型：

- `knowledge_runtime_session`
- `knowledge_position_package`
- `knowledge_citation_log`
- `knowledge_task_memory`

#### task-memory-service

职责：

- 记录 AI 任务目标、输入、检索 query、召回结果和最终输出
- 记录任务是否被人类采纳、是否成功、失败原因
- 将 citation log 与任务绑定
- 识别可沉淀知识候选
- 支持 task memory promoted 为 Wiki proposal

MVP 形态：

- 可与 `audit-trace-service` 合并。
- 先实现结构化任务记录和手动 promote。
- 后续再引入自动摘要、实体抽取和知识候选推荐。

关键模型：

- `knowledge_task_memory`
- `knowledge_wiki_proposal`
- `knowledge_wiki_proposal_evidence`

#### position-package-service

职责：

- 岗位知识管理
- AI 员工上岗配置
- 必读知识
- 默认检索范围
- 禁止事项
- 审批规则
- 人类接管条件

#### knowledge-health-service

职责：

- 知识健康分计算
- 过期检测
- 冲突检测
- 低质量检测
- 高频失败知识检测
- 权限异常检测
- 同步异常检测
- 每日知识健康报告
- 知识静默巡检窗口

#### audit-trace-service

职责：

- 人类操作审计
- AI 检索日志
- AI 引用日志
- AI 任务知识回放
- 权限通过原因记录
- 安全审计导出

## 5. 关键业务链路

### 5.1 知识入库链路

```text
上传/同步文档
  ↓
doc-service 保存源文件与版本
  ↓
parse worker 生成 Markdown 与解析产物
  ↓
wiki-service 生成 Wiki 草稿
  ↓
知识负责人审核发布
  ↓
pipeline-service 生成 chunk
  ↓
embedding + index
  ↓
index-service 更新同步账本
  ↓
retrieval-service 可检索
```

### 5.2 Wiki 修改链路

```text
员工修改 Wiki 页面
  ↓
生成新页面版本
  ↓
检测影响范围
  ↓
审核通过
  ↓
页面版本 active
  ↓
触发增量索引
  ↓
旧 chunk 标记 deprecated
  ↓
新 chunk active
```

补充要求：管理台必须让入库状态可见。文档直推 RAG、文档生成 LLM Wiki 后入 RAG、Wiki 发布后入 RAG，三类路径最终都要落到 `ks_chunk`、`ks_index_record`、`ks_sync_job`，并能在 RAG 管理台的索引 chunk 列表中看到 active chunk。RAG 管理台不应只依赖用户猜测检索词，而应从索引账本反向展示最近可检索内容，同时提供 `ks_acl_policy`、`ks_acl_binding` 与 chunk 部门/岗位标签的查询和管控能力。

### 5.3 AI 员工检索链路

```text
AI 员工发起任务
  ↓
knowledge-runtime-service 加载 AI 身份、岗位、项目、任务上下文
  ↓
加载岗位知识管理 runtime profile、must-read Wiki、默认检索 scope
  ↓
读取必要 Wiki 页面结构化摘要
  ↓
knowledge-runtime-service 编排 retrieval-service 生成检索策略
  ↓
权限预过滤
  ↓
关键词 + 向量召回
  ↓
召回后权限强校验
  ↓
rerank
  ↓
返回带来源结果
  ↓
AI 生成输出
  ↓
记录 citation log、usage event、task memory
```

管理台侧闭环：

```text
管理员配置 AI 员工
  ↓
绑定部门、岗位编码、岗位知识
  ↓
RAG 管理台选择 AI 员工
  ↓
自动带出 actorId、departmentId、positionCode
  ↓
从最近入库知识中选择 chunk 或输入问题
  ↓
retrieval-service 执行检索与权限校验
  ↓
展示召回结果、traceId、权限命中原因、citation log，并可查看/调整 ACL 策略、授权绑定与 chunk 治理标签
```

### 5.4 AI 员工知识沉淀链路

```text
AI 员工完成任务
  ↓
task-memory-service 记录任务过程、引用和输出
  ↓
AI 或系统识别可沉淀知识候选
  ↓
生成 Wiki proposal / knowledge draft
  ↓
绑定来源任务、证据、引用、适用岗位、风险等级
  ↓
知识负责人审核
  ↓
审核通过后 wiki-service 发布 active Wiki 新版本
  ↓
pipeline-service 生成 chunk
  ↓
embedding + index
  ↓
index-service 更新同步账本
  ↓
retrieval-service 可检索新知识
```

### 5.5 每日知识静默巡检链路

```text
巡检前通知
  ↓
进入维护窗口
  ↓
冻结普通写操作
  ↓
生成健康问题清单
  ↓
知识管理员处理冲突、过期、权限、同步异常
  ↓
触发重建索引
  ↓
生成知识健康日报
  ↓
退出维护窗口
```

### 5.6 Knowledge Runtime API 契约

运行时接口建议先按 REST 落地，后续高频场景可以补充内部 gRPC。

```http
GET  /api/ai-employees/{id}/runtime-context
GET  /api/position-packages/{id}/runtime-profile
GET  /api/wiki/pages/{id}/ai-readable

POST /api/retrieval/search
POST /api/retrieval/debug
POST /api/knowledge/citations
POST /api/task-memories

POST /api/knowledge/feedback
POST /api/wiki/proposals
GET  /api/wiki/proposals/{id}
POST /api/wiki/proposals/{id}/approve
POST /api/wiki/proposals/{id}/reject
POST /api/task-memories/{id}/promote-to-wiki
POST /api/knowledge/sync-jobs
GET  /api/knowledge/sync-jobs/{id}
```

接口约束：

- Runtime API 使用 AI 员工独立 token。
- 所有检索请求必须携带 actor、position、project、task_type 和 security_context。
- AI 员工写入只允许 feedback、task memory、Wiki proposal，不允许直接发布 active Wiki。
- proposal 发布后必须进入同步账本，并触发 RAG 增量索引。

## 6. 主要技术选型

### 6.1 前端

| 项目 | MVP 选型 | 目标态选型 | 理由 |
| --- | --- | --- | --- |
| 前端框架 | React + Vite + TypeScript | React + Vite 或 Next.js | 现有项目已使用 React/Vite，迁移成本低 |
| UI 组件 | Tailwind + 自研组件 | Ant Design / Arco / 自研 Design System | 企业后台需要稳定表格、表单、权限控件 |
| Wiki 编辑器 | Markdown Editor + Block Editor 预研 | TipTap / Plate / Lexical | LLM Wiki 需要结构化编辑和块级元数据 |
| 图谱可视化 | Wiki 详情轻量关系面板 | AntV G6 / Cytoscape | MVP 先展示上下游关系网络，后续再做复杂图分析 |

### 6.2 后端

| 项目 | MVP 选型 | 目标态选型 | 理由 |
| --- | --- | --- | --- |
| 主后端 | Spring Boot | Spring Boot 3 + Java 17 | 保留现有 Java 生态，长期建议升级 |
| ORM | MyBatis-Plus | MyBatis-Plus / JPA 混合 | 现有项目已使用 MyBatis-Plus |
| API | REST | REST + 内部 gRPC 可选 | 管理端和 Knowledge Runtime API 先用 REST，检索高频可考虑 gRPC |
| 异步任务 | RocketMQ + Worker | RocketMQ + Temporal/Flowable 可选 | 已有 RocketMQ 骨架，复杂编排后续增强 |
| 任务调度 | Spring Scheduler / XXL-Job | XXL-Job / DolphinScheduler | 巡检、索引重建、报表适合调度 |

说明：

当前 siliconApeClub-admin 使用 Java 8 和 Spring Boot 2.2.x。短期可以继续迭代，但长期企业级产品建议升级到 Java 17 + Spring Boot 3.x，原因是安全维护、依赖生态、性能和云原生支持都更好。

### 6.3 数据库

| 场景 | MVP 选型 | 目标态选型 | 理由 |
| --- | --- | --- | --- |
| 事务主库 | PostgreSQL | PostgreSQL HA | Wiki、权限、知识对象关系强，PostgreSQL 适合 |
| 兼容现有 | MySQL 可继续 | PostgreSQL / MySQL 二选一收敛 | 当前项目 MySQL/H2，需迁移评估 |
| 向量 | pgvector | Milvus / Qdrant / pgvector 分层 | MVP 简化架构，规模扩大后拆向量库 |
| 全文检索 | PostgreSQL FTS | OpenSearch | MVP 可省组件，生产需要混合检索 |
| 对象存储 | MinIO | MinIO 集群 / 云 OSS | 现有项目已有 MinIO 集成 |
| 缓存 | Redis | Redis Sentinel / Cluster | session、限流、热数据、任务状态 |

建议：

如果允许调整当前管理台技术底座，知识层主库优先 PostgreSQL。原因是 PostgreSQL 可以同时承载结构化知识、JSONB、全文检索和 pgvector，MVP 架构更轻。

如果必须沿用 MySQL，则建议：

- MySQL 存业务数据
- Qdrant 或 Milvus 存向量
- OpenSearch 做全文检索

### 6.4 检索与 AI

| 能力 | MVP 选型 | 目标态选型 |
| --- | --- | --- |
| Embedding | 外部 API / bge-m3 私有部署可选 | 多模型 Provider |
| Rerank | 外部 API / bge-reranker 可选 | 独立 rerank 服务 |
| LLM | 外部大模型 API | 外部 API + 私有模型混合 |
| OCR | PaddleOCR / 云 OCR | OCR Worker 服务 |
| 文档解析 | PDFBox / Apache POI / LibreOffice | Unstructured / MinerU / 自研解析插件 |
| 向量库 | pgvector | Milvus / Qdrant |
| 搜索 | PostgreSQL FTS | OpenSearch |

### 6.5 运维与可观测

| 能力 | MVP | 生产 |
| --- | --- | --- |
| 部署 | Docker Compose | Kubernetes |
| 日志 | 本地日志 + Loki 可选 | Loki / ELK |
| 指标 | Prometheus + Grafana | Prometheus + Grafana |
| 链路追踪 | OpenTelemetry 预埋 | OpenTelemetry + Tempo/Jaeger |
| 告警 | Grafana Alerting | Alertmanager + 企业微信/飞书 |
| 备份 | 数据库 dump + 对象存储快照 | PITR + 异地备份 |
| 密钥 | env + 密钥文件 | Vault / K8s Secret / 云 KMS |

## 7. 数据与索引架构

### 7.1 核心存储

```text
PostgreSQL / MySQL
  用户、部门、角色、岗位、AI 员工
  文档、版本、解析产物元数据
  Wiki 页面、版本、模板、关系
  知识对象、chunk 元数据
  ACL 策略、权限绑定
  岗位知识管理
  运行时会话、任务记忆、Wiki proposal
  同步账本
  健康问题、健康报告
  引用日志、审计日志

MinIO
  源文件
  解析中间产物
  图片
  导出报表
  备份文件

pgvector / Milvus / Qdrant
  chunk embedding

OpenSearch
  Wiki 页面索引
  chunk 关键词索引
  审计日志检索
```

### 7.2 chunk 元数据

chunk 必须保存：

```text
chunk_id
source_type
source_id
source_version
wiki_page_id
wiki_page_version
content_hash
chunk_text
chunk_summary
metadata_json
acl_policy_id
acl_version
security_level
position_tags
department_tags
project_tags
knowledge_status
embedding_model
embedding_version
index_version
created_at
updated_at
```

不建议保存展开后的 userIds 作为事实源。若为性能冗余，只能作为 snapshot，并且必须有 `acl_version` 和召回后强校验。

### 7.3 运行时与沉淀元数据

`knowledge_runtime_session` 建议保存：

```text
session_id
ai_employee_id
position_package_id
position_package_version
department_id
project_id
task_type
security_context
acl_version
runtime_profile_hash
created_at
expires_at
```

`knowledge_task_memory` 建议保存：

```text
task_memory_id
ai_employee_id
runtime_session_id
task_id
task_goal
input_summary
query_log
retrieved_chunk_ids
cited_chunk_ids
output_summary
human_feedback
success_status
promote_status
created_at
```

`knowledge_wiki_proposal` 建议保存：

```text
proposal_id
source_task_memory_id
created_by_actor_type
created_by_actor_id
suggested_template
title
draft_content
evidence_json
citation_ids
applicable_positions
risk_level
review_status
reviewer_id
published_page_id
published_page_version
created_at
updated_at
```

## 8. 部署拓扑

### 8.1 M0 最小演示环境

适用：

- 产品演示
- 小规模内部验证
- 不自建大模型
- 不要求高可用

```text
1 台服务器
  Nginx
  Frontend
  Backend Modular Monolith
  Worker
  PostgreSQL + pgvector
  Redis
  MinIO
```

### 8.2 M1 企业试点环境

适用：

- 20 到 100 名员工
- 5 到 20 个 AI 员工
- 10 万级文档以内
- 外部 LLM API

```text
App Node x 1
  Frontend / Backend / Gateway

Data Node x 1
  PostgreSQL / Redis / MinIO

Worker Node x 1
  Parse Worker / Pipeline Worker / Scheduler
```

### 8.3 M2 生产高可用环境

适用：

- 100 到 1000 名员工
- 20 到 200 个 AI 员工
- 百万级 chunk
- 需要高可用

```text
Load Balancer
  ↓
App Node x 2+
  Gateway / API / Wiki / Doc / Admin
  ↓
Worker Node x 2+
  Parse / Pipeline / Health / Report
  ↓
Retrieval Node x 2+
  Hybrid Search / Rerank / Permission Filter
  ↓
Data Layer
  PostgreSQL Primary + Replica
  Redis Sentinel
  MinIO 4 Node Cluster
  OpenSearch 3 Node
  Vector DB 3 Node 或 pgvector
```

### 8.4 M3 本地 AI 增强环境

适用：

- 本地 embedding
- 本地 rerank
- 本地摘要/抽取
- 不一定本地部署完整大模型

```text
M2 基础上增加 GPU Node x 1+
  Embedding Model
  Rerank Model
  Extractor Model
  OCR Model
```

完整本地大模型推理不建议放进最低要求。它会显著抬高硬件门槛和运维难度。

## 9. 容量假设

### 9.1 MVP 假设

```text
人类用户：20 - 100
AI 员工：5 - 20
文档数：1 万 - 10 万
Wiki 页面：5 千 - 5 万
chunk 数：10 万 - 100 万
日检索量：1 千 - 2 万次
日文档增量：100 - 1000 份
单 chunk 平均长度：500 - 1000 tokens
embedding 维度：768 - 1536
```

### 9.2 向量存储估算

粗略估算：

```text
向量原始大小 = chunk 数 * embedding 维度 * 4 字节
```

示例：

```text
100 万 chunk * 1024 维 * 4 字节 ≈ 4GB 原始向量
```

考虑索引、元数据、WAL、冗余和查询性能，实际磁盘与内存需求通常需要放大 3 到 8 倍。因此 100 万 chunk 的 MVP 建议至少预留 64GB 内存和 1TB SSD 级别存储。

## 10. 最低硬件要求

### 10.1 M0 最低可运行环境

前提：

- 使用外部 LLM API
- 使用外部 embedding API 或轻量本地 embedding
- 不做高可用
- 不运行 OpenSearch
- 使用 PostgreSQL + pgvector

最低配置：

| 项目 | 要求 |
| --- | --- |
| 服务器数量 | 1 台 |
| CPU | 4 核 |
| 内存 | 16GB |
| 系统盘 | 100GB SSD |
| 数据盘 | 300GB SSD |
| 网络 | 10Mbps 以上 |
| GPU | 不需要 |
| 适用规模 | 演示、开发、20 人以内试用 |

建议配置：

| 项目 | 要求 |
| --- | --- |
| CPU | 8 核 |
| 内存 | 32GB |
| 数据盘 | 500GB - 1TB SSD |
| 网络 | 50Mbps 以上 |

### 10.2 M1 企业试点最低配置

| 节点 | 数量 | CPU | 内存 | 磁盘 | 用途 |
| --- | --- | --- | --- | --- | --- |
| App Node | 1 | 4 - 8 核 | 16GB | 100GB SSD | 前端、后端、网关 |
| Data Node | 1 | 8 核 | 32GB | 1TB SSD | PostgreSQL、Redis、MinIO |
| Worker Node | 1 | 8 核 | 32GB | 500GB SSD | 解析、切片、索引、日报 |

GPU：不要求。

### 10.3 M2 生产高可用最低配置

| 节点 | 数量 | CPU | 内存 | 磁盘 | 用途 |
| --- | --- | --- | --- | --- | --- |
| App Node | 2 | 8 核 | 32GB | 100GB SSD | API、Wiki、Doc、Admin |
| Worker Node | 2 | 8 - 16 核 | 32GB - 64GB | 500GB SSD | 解析、pipeline、健康巡检 |
| Retrieval Node | 2 | 8 核 | 32GB | 300GB SSD | RAG 检索、rerank 调用 |
| DB Node | 2 | 16 核 | 64GB | 1TB - 2TB SSD | PostgreSQL 主从 |
| Object Storage | 4 | 4 - 8 核 | 16GB - 32GB | 2TB+ | MinIO 集群 |
| Search Node | 3 | 8 核 | 32GB | 1TB SSD | OpenSearch |

GPU：仅在本地模型场景需要。

### 10.4 M3 GPU 增强配置

| 场景 | GPU 建议 | CPU | 内存 | 显存 |
| --- | --- | --- | --- | --- |
| 本地 embedding/rerank | NVIDIA L4 / A10 / L20 单卡 | 16 核 | 64GB | 16GB - 24GB+ |
| 本地 7B/14B 小模型 | L4/A10/L20/4090 单卡或双卡 | 16 - 32 核 | 128GB | 24GB - 48GB+ |
| 本地 32B/70B 大模型 | 多卡 L20/L40S/A800/H800 | 32 核+ | 256GB+ | 96GB+ |

建议：

企业知识层 MVP 不要把本地大模型作为前置条件。本地 GPU 优先用于 embedding、rerank、OCR 和结构化抽取。

## 11. 硬件成本估算

### 11.1 成本口径

以下为粗略估算，实际价格受以下因素影响很大：

- 云厂商
- 地域
- 包年包月或按量
- 是否国产化硬件
- 是否需要发票和企业维保
- 是否使用云数据库、云对象存储、云 OpenSearch
- 是否采购 GPU
- 是否已有公司服务器资源

本估算不包含：

- 大模型 API token 费用
- 商业 OCR 费用
- 商业 rerank/embedding API 费用
- 人员运维成本
- 企业网络专线费用
- 安全等保测评费用

### 11.2 云部署月成本估算

| 档位 | 配置 | 月成本估算 |
| --- | --- | --- |
| M0 最小演示 | 1 台 4C16G + 300GB SSD | 300 - 1200 元/月 |
| M0 建议演示 | 1 台 8C32G + 500GB SSD | 800 - 2500 元/月 |
| M1 企业试点 | 3 台服务器，共约 20C80G + 1.5TB SSD | 3000 - 9000 元/月 |
| M2 生产高可用 | 8 - 15 台节点 + DB 主从 + 搜索 + 存储 | 15000 - 60000 元/月 |
| M3 GPU 增强 | M1/M2 基础上增加单卡 GPU 节点 | 3000 - 15000 元/月/卡 |

说明：

- 国内云在包年包月和活动折扣下价格波动较大。
- 海外云同等配置通常更贵。
- 生产高可用如果使用云托管数据库、托管 OpenSearch、托管对象存储，月成本会更高，但运维压力更低。

### 11.3 自购服务器一次性成本估算

| 档位 | 配置 | 一次性成本估算 |
| --- | --- | --- |
| M0 最小演示 | 单台 4C/8C，16G/32G，1TB SSD | 6000 - 15000 元 |
| M1 企业试点 | 3 台通用服务器，合计约 20C80G，SSD 2TB+ | 30000 - 80000 元 |
| M2 生产高可用 | 8 - 12 台服务器 + 存储 + 交换机 | 150000 - 500000 元 |
| M3 GPU 增强 | 单台 GPU 服务器，L4/A10/L20/4090 级别 | 50000 - 200000 元 |
| 本地大模型多卡 | 多卡 GPU 服务器 | 200000 - 1000000 元+ |

建议：

- 试点期优先云部署。
- 若公司已有机房和服务器，可使用自购服务器。
- 若对数据安全要求极高，可混合部署：业务与知识数据本地，LLM API 通过安全网关调用。

## 12. 运维方案

### 12.1 环境划分

至少划分：

```text
dev：开发环境
test：测试环境
staging：预发布环境
prod：生产环境
```

MVP 允许 dev/test 合并，但生产必须独立。

### 12.2 部署方案

#### MVP

```text
Docker Compose
  frontend
  backend
  worker
  postgres
  redis
  minio
```

适合：

- 快速试点
- 内部演示
- 低成本部署

#### 生产

```text
Kubernetes
  namespace: siliconapeclub
  namespace: observability
  namespace: data
```

建议：

- Stateless 服务用 Deployment
- Worker 用 Deployment + Queue Consumer
- 定时任务用 CronJob
- PostgreSQL 优先使用托管数据库或专用集群
- MinIO 使用 StatefulSet 或独立对象存储

### 12.3 CI/CD

流水线：

```text
代码提交
  ↓
静态检查
  ↓
单元测试
  ↓
构建镜像
  ↓
漏洞扫描
  ↓
推送镜像仓库
  ↓
部署 test
  ↓
集成测试
  ↓
人工审批
  ↓
部署 prod
```

工具建议：

- GitLab CI / GitHub Actions / Jenkins
- Docker Registry / Harbor
- Helm / Kustomize
- SonarQube 可选

### 12.4 监控指标

#### 系统指标

- CPU 使用率
- 内存使用率
- 磁盘使用率
- 磁盘 IO
- 网络带宽
- 容器重启次数

#### 应用指标

- API QPS
- API P95/P99 延迟
- 5xx 错误率
- 登录失败率
- 任务队列堆积
- Worker 成功率
- Worker 失败率

#### 数据指标

- PostgreSQL 连接数
- 慢查询数量
- WAL 增长
- 备份成功率
- Redis 内存
- MinIO 容量
- OpenSearch 集群状态
- 向量索引大小

#### 知识指标

- 待索引页面数
- 索引失败数
- 索引滞后版本数
- chunk 总量
- AI 检索成功率
- AI 检索无结果率
- AI 使用过期知识次数
- 知识健康分
- 每日巡检完成率

### 12.5 告警规则

高优先级告警：

- 生产服务不可用
- 数据库不可用
- 磁盘使用率超过 85%
- 备份失败
- RAG 检索服务错误率超过阈值
- 权限强校验失败异常升高
- AI 越权拦截事件出现
- 知识索引延迟超过 24 小时
- 每日知识健康报告生成失败

中优先级告警：

- Worker 队列积压
- 索引失败率升高
- 同步任务重试次数过高
- API P95 延迟过高
- MinIO 容量超过 70%
- OpenSearch yellow 状态

### 12.6 备份与恢复

#### 备份对象

- 事务数据库
- 对象存储文件
- 向量索引
- OpenSearch 索引
- 配置文件
- 密钥配置
- 健康报告
- 审计日志

#### 备份策略

MVP：

```text
每日全量数据库备份
每日 MinIO 文件快照
保留 7 - 30 天
```

生产：

```text
数据库 PITR
每日全量 + 每小时增量
对象存储版本化
异地备份
保留 30 - 180 天
定期恢复演练
```

#### RPO / RTO 建议

| 环境 | RPO | RTO |
| --- | --- | --- |
| MVP | 24 小时 | 4 - 8 小时 |
| 企业试点 | 4 小时 | 2 - 4 小时 |
| 生产 | 15 分钟 - 1 小时 | 30 分钟 - 2 小时 |

### 12.7 发布与回滚

策略：

- API 服务支持灰度发布。
- 数据库迁移必须向前兼容。
- 索引策略升级必须支持双写或重建。
- embedding 模型升级必须保留旧版本索引。
- RAG 检索服务支持按版本路由。

回滚原则：

- 应用回滚不回滚数据，除非经过人工确认。
- schema 变更必须有兼容期。
- 索引升级失败时切回上一索引版本。

### 12.8 安全运维

要求：

- HTTPS 全站启用。
- 内部服务 mTLS 可作为生产增强项。
- 密钥不进入 Git。
- LLM API Key 使用密钥管理服务。
- AI 员工独立身份与 token。
- 所有检索请求审计。
- 高密级知识默认禁止出现在 AI 生成上下文中。
- 管理员操作强审计。
- 离职用户立即禁用并清理 session。

### 12.9 知识静默窗口运维

每日固定巡检窗口建议放在业务低峰期，例如：

```text
18:00 - 18:30
```

系统动作：

1. 巡检前 10 分钟通知。
2. 进入维护窗口，冻结普通写操作。
3. 外部同步任务进入暂存队列。
4. 知识管理员处理健康问题。
5. 触发必要的增量索引。
6. 生成知识健康日报。
7. 退出维护窗口。
8. 恢复普通写操作。

异常处理：

- 支持紧急修改 override。
- override 必须记录原因、审批人、操作人。
- override 操作进入次日巡检重点。

## 13. 推荐实施路线

### 第 0 阶段：工程清理

- 清理 README 冲突标记。
- 清理误生成文件。
- 统一编码为 UTF-8。
- 明确后端 Java/Spring Boot 升级策略。
- 明确 MySQL 与 PostgreSQL 选择。

### 第 1 阶段：知识模型与同步账本

- 新增 Wiki 页面模型。
- 新增 knowledge_chunk。
- 新增 index_record。
- 将 RAG_SYNC 改为真实 pipeline。
- 页面展示 RAG 同步状态。
- 管理台展示最近 active RAG chunk，便于验证文档/Wiki 推送后是否真正入库。

### 第 2 阶段：RAG 检索服务

- 实现混合检索 MVP。
- 实现权限预过滤。
- 实现召回后强校验。
- 实现 citation log。
- 实现 RAG 管理台。
- 实现 Knowledge Runtime API 基础版。
- 实现 AI 员工 runtime context 加载。
- RAG 管理台支持选择 AI 员工，并自动使用其部门、岗位和权限边界；同时支持索引 chunk 可见性、ACL 策略、授权绑定与权限命中原因查询。

### 第 3 阶段：岗位知识管理

- 基于 Wiki 页面的岗位知识管理。
- AI 员工绑定岗位知识。
- 默认检索范围。
- 管理台支持 AI 员工基础配置、启停、部门/岗位维护和岗位知识绑定。
- 必读知识。
- 审批边界。
- 岗位 runtime profile。
- must-read Wiki 结构化读取。

### 第 4 阶段：知识健康中心

- 健康问题池。
- 热度统计。
- 冲突检测。
- 过期检测。
- 同步异常检测。
- 每日静默巡检窗口。
- 知识健康日报。
- task memory 基础记录。
- Wiki proposal 审核队列。

### 第 5 阶段：高可用和企业系统接入

- OpenSearch。
- 独立向量库。
- Kubernetes。
- 企业系统连接器。
- 更完善的审计与合规。
- task memory 到 Wiki 的自动沉淀推荐。
- AI 员工知识反馈闭环。

## 14. 架构结论

企业知识层不应从第一天就重微服务化，但必须从第一天按微服务边界建模。

推荐落地方式：

```text
MVP：硅基猿猴俱乐部管理台 + `siliconApeClub-server` 模块化单体 + Pipeline Worker + Retrieval Service
下一阶段：新增 `siliconApeClub-worker-platform`，承载硅基俱乐部员工平台与对外 AI 员工服务能力
试点：拆分 Wiki / Pipeline / Retrieval / Health
生产：完整微服务 + 高可用数据层 + 可观测运维体系
```

最低可运行硬件不需要 GPU，4C16G 即可演示，8C32G 更适合作为单机试点。生产环境的关键成本来自数据库、搜索、对象存储、索引计算和高可用冗余，而不是 Web 服务本身。GPU 应作为本地 AI 能力增强项，不应成为知识层 MVP 的硬性门槛。

最终架构目标是：人类能管理知识，LLM Wiki 能组织知识，RAG 能安全调用知识，AI 员工能解释自己用了什么知识，知识管理员能每天维护知识资产健康。
