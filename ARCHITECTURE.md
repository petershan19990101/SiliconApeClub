# 企业知识层系统架构设计

所属平台：硅基猿猴俱乐部  
关联产品：Silicon Ape Club Knowledge Layer  
版本：v0.2  
状态：当前架构基线  
日期：2026-06-27

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

### 2.1 当前采用模块化服务边界

当前架构采用“管理台模块化单体 + 平级知识服务 + Docker Compose 编排”的形态。`siliconApeClub-server` 承载管理台后端与 API Gateway 合并能力，`retrieval-service`、`knowledge-pipeline-worker`、`knowledge-runtime-service`、`task-memory-service` 作为根目录平级服务独立运行。

代码、数据模型、接口和事件按逻辑服务边界组织，当前重点是让管理台、Wiki、RAG、AI 员工配置、岗位知识管理和任务记忆形成闭环。

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
  Admin Console Frontend
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
  Redis
  MinIO
  RocketMQ
      ↓
AI 能力层
  LLM Provider
  Embedding Provider
  Rerank Provider
  OCR / Parser / Extractor
```

## 4. 微服务结构

### 4.1 当前逻辑服务

当前逻辑服务直接对应已落地的工程目录、容器服务和 API 边界。

| 逻辑服务 | 当前物理承载 | 当前职责 | 数据边界 |
| --- | --- | --- | --- |
| Admin Console Frontend | `siliconApeClub-front` | 硅基猿猴俱乐部管理台静态入口，承载知识资产、Wiki 中心、RAG 管理台、AI 员工配置、岗位知识管理、权限与知识健康运营 | 无状态静态资源 |
| API Gateway | `siliconApeClub-server` | `/api/**` 统一入口、JWT 鉴权、CORS、管理台后端代理 | 共享主库 |
| Auth & IAM Service | `siliconApeClub-server` | 用户、角色、部门、菜单、按钮权限、AI 员工身份和权限边界 | 共享主库 |
| Doc Service | `siliconApeClub-server` | 文档上传、目录、版本、解析产物、源文件管理、审核发布、推送 RAG | 共享主库 + MinIO |
| Wiki Center Service | `siliconApeClub-server` | Wiki 页面、版本、发布、归档、结构分组、权限展示、页面关系维护 | 共享主库 |
| RAG Management Service | `siliconApeClub-server` + `retrieval-service` | RAG 调试回放、索引 chunk 可见性、ACL policy/binding 管控、chunk 治理 | 共享主库 + pgvector |
| Knowledge Pipeline Worker | `knowledge-pipeline-worker` + `siliconApeClub-server` | 文档到 Wiki、Wiki 到 chunk、同步任务、通知与审计证据 | 共享主库 + RocketMQ |
| Knowledge Index Service | `retrieval-service` | chunk 写入、embedding、pgvector 索引、索引账本状态回写 | 共享主库 + pgvector |
| Retrieval Service | `retrieval-service` | RAG 检索、权限预过滤、rerank、召回后强校验、citation callback | 共享主库 + pgvector |
| Knowledge Runtime Service | `knowledge-runtime-service` | AI 员工 runtime context、AI 可读 Wiki、岗位 profile、Wiki proposal 审核入口 | 共享主库 |
| Task Memory Service | `task-memory-service` | AI 任务记忆、citation 关联、沉淀候选、Wiki proposal promotion | 共享主库 |
| Position Knowledge Service | `siliconApeClub-server` | 基于 Wiki 的岗位知识管理、AI 员工绑定、默认检索范围、审核发布 | 共享主库 |
| Knowledge Health Service | `siliconApeClub-server` | 冲突检测、过期检测、同步异常、权限异常、健康报告和巡检窗口 | 共享主库 |
| Audit Trace Service | `siliconApeClub-server` | 人类操作审计、AI 引用日志、检索回放日志 | 共享主库 |
| Notification Service | `siliconApeClub-server` | 巡检通知、审核通知、同步失败通知 | 共享主库 |

当前物理进程：

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

reserved:
  siliconApeClub-worker-platform/
```

`siliconApeClub-admin` 定位为管理平台，服务业务人员、知识管理员、测试和运营同学；`siliconApeClub-worker-platform` 是预留的硅基俱乐部员工平台工程，面向外部 AI 员工服务能力、任务入口与运行期交互。两者共用知识层事实源，管理台负责“管理和治理”，员工平台负责“调用和服务”。

### 4.2 服务边界

当前代码和数据模型按以下服务边界组织。独立部署与否不改变接口和数据职责：

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
position-knowledge-service
knowledge-health-service
audit-trace-service
notification-service
admin-console
```

### 4.3 服务职责详情

#### gateway-service

职责：

- API 路由
- JWT 校验
- 统一限流
- 请求日志
- CORS
- 管理台后端代理

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

当前管理端接口：

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

关系图谱当前由 PostgreSQL `ks_wiki_relation` 承载轻量网络，Wiki 中心在页面详情中展示入向、出向和关系类型。

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

当前承载：

- `siliconApeClub-server` 负责管理台触发、审核和任务入口。
- `knowledge-pipeline-worker` 负责独立文档到 Wiki 流水线。
- `retrieval-service` 负责写入 chunk、embedding 和索引记录。

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

当前独立部署原因：

- 与 AI 员工交互频率高
- 性能要求不同于后台管理
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

当前形态：

- 独立进程 `knowledge-runtime-service`。
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

当前形态：

- 独立进程 `task-memory-service`。
- 实现结构化任务记录和 Wiki proposal promotion。

关键模型：

- `knowledge_task_memory`
- `knowledge_wiki_proposal`
- `knowledge_wiki_proposal_evidence`

#### position-knowledge-service

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

运行时接口当前按 REST 落地。

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

| 项目 | 当前选型 | 当前用途 |
| --- | --- | --- |
| 前端框架 | React + Vite + TypeScript | 管理台单页应用 |
| 样式体系 | Tailwind CSS + 自研组件 | 表格、表单、弹窗、权限控件、知识运营页面 |
| 文档预览 | `pdfjs-dist`、`docx-preview`、`xlsx`、自研渲染器 | 文档源文件和解析结果预览 |
| Wiki 编辑 | Markdown Editor + Markdown 渲染 | Wiki 正文编辑、解析内容校正、知识提案展示 |
| Wiki 结构化展现 | 三栏结构工作台 | 分组树、页面列表、详情/权限/关系面板 |
| 关系图谱 | Wiki 详情轻量关系网络 | 展示引用、依赖、相关、替代、重复关系 |
| 静态资源部署 | Python `serve_static.py` 容器 | `/m/silicon-ape-club-admin/` 管理台入口 |

### 6.2 后端

| 项目 | 当前选型 | 当前用途 |
| --- | --- | --- |
| 管理台后端 | Java 8 + Spring Boot 2.2.x | `siliconApeClub-server` 管理台 API、鉴权、知识治理入口 |
| ORM | MyBatis-Plus | 业务表 CRUD、分页、条件查询 |
| API | REST + OpenAPI | 管理台接口、内部知识接口、RAG 代理接口 |
| 启动产物 | WAR / executable jar | Docker runtime-prebuilt 镜像运行 `siliconApeClub-server.war` |
| Python 服务 | Python 3.11 + FastAPI | `retrieval-service`、`knowledge-runtime-service`、`task-memory-service`、`knowledge-pipeline-worker` |
| 异步任务 | RocketMQ + Worker | 文档生命周期、知识同步、流水线任务 |
| 配置 | Spring YAML + 环境变量 | Docker Compose 本地/测试启动配置 |

### 6.3 数据库

| 场景 | 当前选型 | 当前用途 |
| --- | --- | --- |
| 事务主库 | PostgreSQL | 用户、权限、文档、Wiki、岗位知识、AI 员工、审计、任务记忆 |
| 向量索引 | pgvector | `ks_chunk.embedding` 和 RAG 召回 |
| 关系图谱 | PostgreSQL 表关系 | `ks_wiki_relation` 承载 Wiki 轻量关系网络 |
| 对象存储 | MinIO | 源文件、解析产物、预览缓存 |
| 缓存 | Redis | 缓存、限流、任务状态扩展 |
| 消息队列 | RocketMQ | 文档生命周期事件和知识流水线触发 |

### 6.4 检索与 AI

| 能力 | 当前选型 | 当前用途 |
| --- | --- | --- |
| Embedding | 阿里云百炼 DashScope，缺省 hash fallback | chunk embedding、开发环境无 key 时可运行 |
| Rerank | DashScope rerank 接口，可缺省跳过 | RAG 管理台调试和 AI 员工检索 |
| LLM | 外部大模型 API 预留 | Wiki 生成、摘要、知识反馈扩展 |
| 文档解析 | Apache PDFBox、Apache POI、LibreOffice 预览转换 | PDF、Word、PPT、Excel 等文档解析与预览 |
| 向量库 | pgvector | RAG 向量召回 |
| 检索服务 | FastAPI `retrieval-service` | 搜索、debug、sync job、权限校验 callback、citation callback |

### 6.5 运维与可观测

| 能力 | 当前选型 | 当前用途 |
| --- | --- | --- |
| 本地/测试部署 | Docker Compose | `--profile app` 启动管理台、知识服务和中间件 |
| 日志 | 容器 stdout + 应用日志文件 | Docker 日志查看、后端 `logs/siliconApeClub-server.log` |
| 健康检查 | HTTP health / OpenAPI / Docker healthcheck | 服务启动验证、测试验收 |
| 数据库迁移 | Flyway | PostgreSQL schema 初始化和菜单/权限升级 |
| 镜像 | Dockerfile + Compose build | 前端静态镜像、后端 WAR 运行镜像、Python 服务镜像 |
| 配置与密钥 | 环境变量 | 数据库、Redis、MinIO、RocketMQ、DashScope key |

## 7. 数据与索引架构

### 7.1 核心存储

```text
PostgreSQL
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

pgvector
  chunk embedding

Redis
  缓存
  限流
  任务状态扩展

RocketMQ
  文档生命周期事件
  知识流水线触发
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

系统不保存展开后的 userIds 作为权限事实源。若为性能冗余保存 snapshot，必须带 `acl_version` 并执行召回后强校验。

### 7.3 运行时与沉淀元数据

`knowledge_runtime_session` 保存：

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

`knowledge_task_memory` 保存：

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

`knowledge_wiki_proposal` 保存：

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

### 8.1 当前 Docker Compose 拓扑

```text
Docker Compose profile: app

入口层
  sac-siliconapeclub-front
    http://localhost:3000/m/silicon-ape-club-admin/

管理台后端
  sac-siliconapeclub-server
    http://localhost:8080

知识服务
  sac-retrieval-service
    http://localhost:8090
  sac-knowledge-runtime-service
    http://localhost:8091
  sac-task-memory-service
    http://localhost:8092
  sac-knowledge-pipeline-worker
    http://localhost:8093

数据与中间件
  sac-postgres
    localhost:15432
  sac-redis
    localhost:16379
  sac-minio
    http://localhost:19000
    console: http://localhost:19001
  sac-rocketmq-namesrv
    localhost:19876
  sac-rocketmq-broker
    localhost:10909 / 10911 / 10912
```

### 8.2 当前容器服务

| Compose 服务 | 容器名 | 镜像 | 端口 |
| --- | --- | --- | --- |
| `siliconapeclub-front` | `sac-siliconapeclub-front` | `siliconapeclub-front:latest` | `3000:80` |
| `siliconapeclub-server` | `sac-siliconapeclub-server` | `siliconapeclub-server:latest` | `8080:8080` |
| `retrieval-service` | `sac-retrieval-service` | `siliconapeclub-retrieval-service:latest` | `8090:8090` |
| `knowledge-runtime-service` | `sac-knowledge-runtime-service` | `siliconapeclub-knowledge-runtime-service:latest` | `8091:8091` |
| `task-memory-service` | `sac-task-memory-service` | `siliconapeclub-task-memory-service:latest` | `8092:8092` |
| `knowledge-pipeline-worker` | `sac-knowledge-pipeline-worker` | `siliconapeclub-knowledge-pipeline-worker:latest` | `8093:8093` |
| `postgres` | `sac-postgres` | `pgvector/pgvector:pg16` | `15432:5432` |
| `redis` | `sac-redis` | `redis:7.2-alpine` | `16379:6379` |
| `minio` | `sac-minio` | `minio/minio` | `19000:9000`、`19001:9001` |
| `rocketmq-namesrv` | `sac-rocketmq-namesrv` | `apache/rocketmq:4.9.7` | `19876:9876` |
| `rocketmq-broker` | `sac-rocketmq-broker` | `apache/rocketmq:4.9.7` | `10909`、`10911`、`10912` |

### 8.3 当前启动与验证入口

```powershell
docker compose --profile app up -d
docker compose --profile app ps
```

关键验证入口：

- 管理台：`http://localhost:3000/m/silicon-ape-club-admin/`
- OpenAPI：`http://localhost:8080/v3/api-docs`
- Swagger UI：`http://localhost:8080/swagger-ui/index.html`
- Retrieval health：`http://localhost:8090/api/retrieval/health`
- Knowledge Runtime health：`http://localhost:8091/health`
- Task Memory health：`http://localhost:8092/health`
- Pipeline Worker health：`http://localhost:8093/health`

## 9. 容量假设

### 9.1 当前容量假设

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

考虑索引、元数据、WAL、冗余和查询性能，实际磁盘与内存需求通常需要放大 3 到 8 倍。因此 100 万 chunk 部署至少预留 64GB 内存和 1TB SSD 级别存储。

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

当前知识层不把本地大模型作为前置条件。本地 GPU 优先用于 embedding、rerank、OCR 和结构化抽取。

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

当前本地验证环境允许 dev/test 合并，生产环境必须独立。

### 12.2 部署方案

#### 当前本地/测试部署

```text
Docker Compose
  siliconapeclub-front
  siliconapeclub-server
  retrieval-service
  knowledge-runtime-service
  task-memory-service
  knowledge-pipeline-worker
  postgres
  redis
  rocketmq
  minio
```

适合：

- 本地验证
- 内部演示
- 测试验收

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

当前本地/测试：

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
| 本地/测试 | 24 小时 | 4 - 8 小时 |
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

## 13. 当前已落地能力

### 13.1 工程与部署

- 根目录保留平级服务：`siliconApeClub-admin`、`retrieval-service`、`knowledge-pipeline-worker`、`knowledge-runtime-service`、`task-memory-service`。
- `siliconApeClub-admin` 内部包含 `siliconApeClub-front` 和 `siliconApeClub-server`。
- 根目录 `docker-compose.yml` 统一编排管理台、知识服务、PostgreSQL/pgvector、Redis、RocketMQ 和 MinIO。
- 前端静态资源容器提供 `/m/silicon-ape-club-admin/` 管理台入口。
- 后端以 `siliconApeClub-server.war` 构建镜像并运行，OpenAPI 标题为 `Silicon Ape Club Admin API`。

### 13.2 管理台能力

- 知识资产：文档上传、目录、版本、解析产物、人工校正、审核发布、RAG 推送状态。
- 权限管理：菜单、角色、用户、部门、按钮权限、AI 员工可读边界。
- Wiki 中心：结构分组、页面列表、详情、ACL 展示、关系图谱、关系新增与删除。
- RAG 管理台：RAG 调试回放、active chunk 可见性、ACL policy/binding 管控、chunk 治理。
- AI 员工配置：AI 员工基础信息、启停、部门/岗位、岗位知识绑定。
- 岗位知识管理：基于 Wiki 页面集合的岗位知识 profile，支持增删改查、提交审核、审核通过、驳回、归档和删除。
- 知识健康：健康问题、同步异常、权限异常、维护窗口和健康报告入口。

### 13.3 知识层闭环

- 文档可生成 Wiki 草稿。
- Wiki 发布后进入同步账本并写入 RAG 索引。
- 文档直推 RAG、文档生成 Wiki 后入 RAG、Wiki 发布后入 RAG 都落入 `ks_sync_job`、`ks_chunk`、`ks_index_record`。
- RAG 检索结果携带来源、版本、分数和权限校验信息。
- citation log、task memory 和 Wiki proposal 为 AI 员工反向沉淀知识提供证据链。

## 14. 架构结论

当前架构基线是：`siliconApeClub-admin` 管理台 + `siliconApeClub-server` 管理台后端 + `siliconApeClub-front` 静态入口 + 平级知识服务 + PostgreSQL/pgvector 事实源。

管理台负责知识治理、权限、配置、审核、观测和运营；Knowledge Runtime、Task Memory、Retrieval 和 Pipeline 服务负责 AI 员工运行期的知识读取、检索、记忆与沉淀。`siliconApeClub-worker-platform` 作为员工平台工程边界预留，面向 AI 员工服务能力和任务交互，不承载后台治理职责。

这套基线保证三件事：人类能管理知识，RAG 能安全调用知识，AI 员工能解释并沉淀自己使用过的知识。
