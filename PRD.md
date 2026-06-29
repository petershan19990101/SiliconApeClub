# 企业知识层产品 PRD

产品代号：Silicon Ape Club Knowledge Layer  
所属平台：硅基猿猴俱乐部  
版本：v0.2  
状态：当前产品基线  
日期：2026-06-28

## 1. 背景

硅基猿猴俱乐部的目标不是凭空搭建一套多 Agent 聊天系统，而是逐步嵌入公司现有组织，以岗位为单位替换或增强现有人力组织能力。这个目标成立的前提，是公司必须先拥有一套稳定、可信、可持续维护、同时适合人类和 AI 员工理解的企业知识资产。

当前 siliconApeClub-admin 已经具备文档上传、目录、权限、版本、解析、人工校正、审计、发布、RAG 同步状态等能力，适合作为第一阶段的文档治理基础。但如果要支撑 AI 员工真正工作，仅有文档库和普通 RAG 不够。企业需要的是一套完整的知识层：

- 人类可以管理、编辑、审核、巡检知识。
- LLM Wiki 可以承载结构化、可读、可维护的知识本体。
- RAG 可以为 AI 员工提供受权限控制、可追溯、可评估的知识调用能力。
- 知识管理员可以定期维护冲突、过期、低质、权限异常和同步异常知识。
- 系统可以持续输出知识健康报告，让企业知识资产成为公司运行的基石。

本 PRD 定义整个企业知识层的产品范围、角色、流程、能力、数据模型和分阶段交付路径。

## 2. 产品定位

企业知识层是硅基猿猴俱乐部的核心记忆层，也是 AI 员工体系的知识底座。

它不是传统文档库，也不是单纯 RAG 知识库，而是：

> 面向人类管理的知识资产平台 + 面向人机共读的 LLM Wiki + 面向 AI 员工调用的 RAG Memory。

三层关系如下：

```text
人类管理层 硅基猿猴俱乐部管理台
  负责文档接入、权限、版本、审核、审计、知识运营
  ↓
LLM Wiki 层
  负责知识组织、结构化表达、人机共读、关系沉淀
  ↓
RAG Memory 层
  负责切片、索引、检索、权限过滤、引用追溯、AI 员工调用
```

工程与平台边界：

- `siliconApeClub-admin` 是硅基猿猴俱乐部管理台，面向业务人员、知识管理员、测试和运营同学，负责知识接入、治理、配置、审核、权限和观测。
- `siliconApeClub-admin/siliconApeClub-front` 是管理台前端。
- `siliconApeClub-admin/siliconApeClub-server` 是管理台后端。
- `retrieval-service`、`knowledge-pipeline-worker`、`knowledge-runtime-service`、`task-memory-service` 与管理台平级，保持知识层微服务边界。
- `siliconApeClub-worker-front` 是硅基俱乐部 AI 员工平台前端，对外提供 AI 员工服务台、业务前台聊天、快捷能力表单、多模态输出和任务账本展示。
- `siliconApeClub-worker-platform` 是硅基俱乐部 AI 员工平台后端，对外提供 `/api/worker-platform/**` 运行期 API，承载业务前台、组织化派发、员工直派、任务账本、长任务恢复和知识沉淀发起能力。
- 管理台负责“治理知识与配置员工”，员工平台负责“调用知识、组织协作与交付服务”。

## 3. 建设目标

### 3.1 业务目标

1. 建立统一、可信、可治理的企业知识资产库。
2. 让知识同时适合人类员工阅读维护和 AI 员工理解调用。
3. 支持 AI 员工快速理解公司组织、业务、产品、技术、流程和历史决策。
4. 为逐岗替换提供岗位知识管理、权限边界、任务上下文和审批规则。
5. 通过知识健康巡检机制，持续减少过期、冲突、重复、低质知识。
6. 让 AI 员工干活可解释：知道它看了什么、为什么这么做、用了哪个版本的知识。

### 3.2 产品目标

1. 从文档库升级为知识资产平台。
2. 从“上传文档后问答”升级为“知识生产、发布、索引、调用、反馈、巡检”的闭环。
3. 从单一权限控制升级为覆盖人类员工与 AI 员工的统一权限体系。
4. 从普通文档目录升级为岗位知识管理、项目知识、流程知识、组织记忆。
5. 从不可感知的 RAG 黑盒升级为可同步、可追溯、可回放、可评估的 RAG Memory。

### 3.3 AI 员工平台第一版目标

1. 建立统一客户端入口，浏览器访问 `siliconApeClub-worker-front`，业务 API 只走 `/api/worker-platform/**`。
2. 支持客户登录鉴权，区分外部客户、内部人员、管理员和 AI 员工身份。
3. 客户端按服务对话管理历史聊天记录、任务、附件和产出物；后端仍用内部账本聚合这些记录。
4. 初始化“业务前台人员”角色，外部客户默认由业务前台接待。
5. 内部人员可按权限查看组织关系，对授权 AI 员工派活或咨询。
6. 管理台组织与人力中心作为公司组织、岗位、AI 员工属性、员工生命周期、联系人关系、模型 Profile 选择、岗位知识绑定、考核规则和计量数据的权威配置源。
7. 客户会员中心维护客户角色、角色默认可见部门/员工、会员附加可见部门/员工、可咨询和可派活权限。
8. 技能仓库维护人类编写或 AI 员工总结出来的员工执行 Skill，必须审核通过后才能绑定到员工和投影到 worker platform。
9. 系统快捷能力维护客户端快捷能力分组、表单、交易系统服务编码、动作码、展示 HTML、关键词、启停、排序和可见边界，它是业务系统对客接口配置，不属于 AI 员工 Skill。
10. Worker Platform 启动时把管理台组织、客户可见性、审核通过的技能和员工技能绑定投影到 `wp_*` 运行时表；客户端快捷能力实时从 `client_quick_capability*` 投影，客户端只读取 worker platform。
11. 前台接收任务后，按组织关系、部门职责、岗位知识包和 Skill 拆解派发。
12. 支持 markdown、受控 html、动态 form、artifact、task_status、org_route、employee_card 等多模态输出。
13. 支持对客快捷能力入口，客户可直接选择业务下单、查询订单进度、退货申请、查询服务地址等确定性业务动作。
14. AI 员工在聊天中识别到确定性业务意图时，优先输出对应表单；表单提交后直接进入业务动作和任务账本，不再为了结构化入参重复调用大模型。
15. 建立长任务账本、事件流和 checkpoint，服务重启或停电后可按服务对话和任务账本恢复。
16. 支持任务结论沉淀为候选 Wiki，经审核发布后同步 RAG。
17. 管理台系统设置提供 `AI 模型配置`，统一维护文档转 Wiki、RAG Embedding、RAG Rerank、AI 员工聊天分析等模型用途的供应商、端点、模型、密钥、超时、默认项和 fallback 策略。

## 4. 范围

### 4.1 本期范围

本 PRD 覆盖整个知识层产品设计，包括：

- 人类管理层
- LLM Wiki 层
- AI 员工 RAG 层
- 知识权限体系
- 岗位知识管理
- 知识热度与质量评估
- Wiki 与 RAG 一致性
- AI 员工平台 Worker Runtime API
- AI 员工反向沉淀 Wiki 流程
- 组织与人力中心、技能仓库、系统快捷能力、客户会员中心、服务对话归档、聊天记录、业务前台、员工派活、组织关系、员工绩效计量和长任务恢复
- AI 模型配置与真实模型调用闭环，包括 `document_to_wiki`、`rag_embedding`、`rag_rerank`、`worker_chat`
- 知识管理员与知识健康报告
- 每日知识静默巡检窗口
- 数据模型与技术架构建议
- 原 DocSpace 工程能力的保留、升级与推倒原因

### 4.2 非本期范围

以下能力只预留接口，不在当前 MVP 中完整实现：

- 多 Agent 工作流平台
- 企业业务系统自动执行
- 跨公司知识市场
- 复杂知识图谱推理

## 5. 原 DocSpace 设计评估与当前落地

### 5.1 建议保留的能力

当前 siliconApeClub-admin 的以下工程资产应保留并继续演进：

- 文档上传与源文件存储
- 目录与部门管理
- 文档版本管理
- 解析引擎 SPI
- 解析中间产物管理
- 人工校正能力
- 审核、发布、驳回、修订草稿流程
- RBAC 权限中心
- 文档审计日志
- MinIO、Redis、RocketMQ、Flyway 等基础设施集成

这些能力是知识生产线的前置基础，不应推倒。

### 5.2 已升级的能力

以下能力方向正确，当前已经从“文档级”升级为“知识级”：

| 当前能力 | 问题 | 升级方向 |
| --- | --- | --- |
| RAG_SYNC 状态 | 只表示同步动作，不代表真实知识索引完成 | 升级为知识加工流水线 |
| 文档状态 | 混合了承载文件和知识发布状态 | 拆分文档状态与知识状态 |
| LIKE 搜索 | 只能做基础文档搜索 | 升级为关键词 + 向量 + 结构化过滤 + rerank |
| 文档 ACL | 主要面向人类用户 | 扩展到 AI 员工、AI 岗位、AI 团队 |
| 解析校正 | 面向文档正文修正 | 升级为知识条目、Wiki 页面、chunk 质量校正 |
| 审计日志 | 记录人类文档操作 | 扩展为知识使用审计、AI 引用审计 |

### 5.3 已重构的产品边界

这里的“推倒”不是删除所有代码，而是推倒原有产品边界和部分核心模型。

#### 5.3.1 推倒“文档库即知识库”的假设

原因：文档只是知识来源，不等于知识本体。AI 员工需要的是可检索、可引用、可追溯、可判断时效和权限的知识单元。

调整：引入独立知识对象模型，包括 Wiki 页面、知识条目、chunk、索引记录、引用日志、健康问题。

#### 5.3.2 推倒“RAG 同步是按钮动作”的设计

原因：RAG 同步不是一次点击，而是一条生产流水线。它包括清洗、切片、摘要、标签、实体抽取、权限快照、向量化、索引、质量检查和发布。

调整：将 RAG 同步升级为可观测、可重试、可回滚、可审计的知识加工任务。

#### 5.3.3 推倒“文档版本与知识版本等价”的设计

原因：一份文档可能生成多个 Wiki 页面和多个知识 chunk。Wiki 页面可能被人工重组，知识 chunk 可能因切片策略变化而变化。

调整：文档版本、Wiki 版本、chunk 版本、索引版本分别建模，并通过同步账本关联。

#### 5.3.4 推倒“权限只挂在文档上”的设计

原因：AI 员工调用知识时，权限必须细化到页面、知识对象、chunk、岗位包、任务上下文。

调整：建立统一知识 ACL 与权限策略引用，chunk 不保存展开后的 userIds 作为事实源，而是保存 ACL 引用、权限版本和稳定权限标签。

#### 5.3.5 推倒“搜索结果不可解释”的设计

原因：AI 员工干活不好时，必须能判断是模型问题、知识问题、检索问题、权限问题还是同步问题。

调整：RAG 每次检索、召回、rerank、引用都必须记录可回放日志。

### 5.4 当前实现口径

文档解析后的默认知识生命周期为：

```text
上传文档
  -> 自动/手动解析
  -> 生成或更新 LLM Wiki
  -> Wiki 发布
  -> RAG chunk、embedding、index record 写入
  -> 文档进入 RAG_READY
  -> 提交审核
  -> 审核发布
  -> 管理员删除时级联清理 LLM Wiki 与 RAG 派生内容
```

当前落地要求：

| 原设计问题 | 当前实现 |
| --- | --- |
| 文档库即知识库 | 文档只作为来源，解析产物通过 `/api/documents/{id}/to-wiki` 生成 `ks_wiki_page`，再进入索引 |
| RAG 同步是按钮动作 | 管理台默认按钮为“生成 Wiki 入 RAG”，触发 `ks_pipeline_job`；`/rag-sync` 仅作为兼容和排障直推入口 |
| 文档版本等同知识版本 | `ks_pipeline_job.source_id/source_version` 关联文档版本，`ks_wiki_page_version` 管 Wiki 版本，`ks_index_record` 管索引版本 |
| 权限只挂文档 | 文档生成 Wiki 时创建或刷新 `ks_acl_policy`、`ks_acl_binding`，Wiki 与 chunk 引用该 ACL 策略和版本 |
| 搜索结果不可解释 | RAG 管理台、`ks_citation_log`、`ks_audit_trace` 支持召回、引用、权限和流水线结果追踪 |
| 文档删除后知识残留 | 文档删除触发 `document_knowledge_delete` 清理账本，关联 Wiki 页面标记 deleted 并清空正文，RAG chunk/index record 标记 deleted 并清空文本与 embedding |

同一文档同一版本重复触发生成 Wiki 时，不新建重复 Wiki 页面，而是复用已有关联页面，更新 Wiki 版本并重建 RAG 索引。

### 5.5 文档类型与默认解析器

当前文档接入不再只面向 Office/PDF。直接上传的文本类文件属于天然可解析知识来源，应自动进入解析产物和 Wiki/RAG 流水线。

当前解析策略：

| 文件类型 | 默认解析器 | 产品口径 |
| --- | --- | --- |
| PDF | `apache_pdfbox_java_engine` | 提取页级文本和图片产物 |
| DOCX | `apache_poi_docx_java_engine` | 提取正文、标题、表格、图片并输出 Markdown |
| PPTX | `apache_poi_pptx_java_engine` | 提取幻灯片文本、表格、备注、图片并输出 Markdown |
| Markdown | `plain_text_java_engine` | 原文直通为 Markdown 解析结果 |
| TXT/SQL/LOG/JSON/YAML/XML/配置文件/代码文件 | `plain_text_java_engine` | 直接按文本读取，生成页级文本和 Markdown 产物 |
| HTML/HTM | `html_to_markdown_java_engine` | 将标题、段落、列表、链接、引用、代码块等结构转换为 Markdown |

验收要求：

- 上传 `.md`、`.txt`、`.sql`、`.log`、`.html` 文件时，系统应自动进入解析流程。
- 解析成功后应写入 `ds_document_version.parsed_content`，并生成 `text` 与 `markdown` 解析产物。
- 后续 `生成 Wiki / 生成 Wiki 入 RAG` 流程不区分来源格式，统一使用 Markdown 解析结果。
- 未配置解析器的文件仍可作为源文件保存，但不会自动进入知识流水线，前端应给出明确支持范围。

## 6. 用户角色

### 6.1 知识管理员

负责企业知识资产质量和知识健康巡检。

核心职责：

- 维护知识分类、模板、标签、生命周期。
- 审核重要知识发布。
- 处理知识冲突、过期、重复、低质问题。
- 管理每日知识静默巡检窗口。
- 输出知识健康报告。
- 跟踪 AI 员工使用知识失败的原因。
- 推动部门知识负责人修复问题。

### 6.2 部门知识负责人

负责本部门知识资产。

核心职责：

- 维护部门 Wiki。
- 审核部门知识变更。
- 处理本部门知识冲突和过期问题。
- 维护部门岗位知识。
- 配合知识管理员巡检。

### 6.3 普通员工

负责知识生产和使用。

核心职责：

- 创建、编辑、评论、引用知识。
- 提交知识修订。
- 反馈知识错误。
- 在知识静默窗口内停止知识变更，配合巡检。

### 6.4 AI 员工

负责读取、引用、生成、沉淀知识。

核心职责：

- 按身份、岗位、任务权限读取知识。
- 启动任务时加载运行时上下文、岗位知识和 must-read Wiki。
- 引用知识完成工作。
- 在输出中保留 citation log，说明引用了哪些 Wiki 页面、版本和 chunk。
- 发现冲突、过期、不足知识时提交反馈。
- 在允许范围内生成 Wiki 草稿或知识沉淀提案。
- 不得绕过权限或引用不可用知识。

### 6.5 外部客户

外部客户通过 AI 员工平台与业务前台或授权 AI 员工对话。

核心职责：

- 登录后查看自己的历史对话、任务状态和产出物。
- 默认由业务前台接待，只能查看客户会员中心授权的部门、员工和可操作权限。
- 通过动态表单补充精准数据、附件说明和验收标准。
- 查看任务进度，并对产出进行反馈。

### 6.6 内部人员

内部人员代表公司内部使用者，可以在授权范围内查看组织关系和派活。

核心职责：

- 查看权限范围内的 AI 员工、部门、任务和协作记录。
- 对授权员工发起咨询或派发任务。
- 审核、转派或恢复任务。
- 参与任务结论沉淀和 Wiki 候选审核。

### 6.7 业务前台 AI 员工

业务前台是外部客户默认入口，模拟公司前台业务人员。

核心职责：

- 接待客户事项，澄清目标、边界、材料和验收标准。
- 在聊天识别到需要精确入参的业务动作时，输出对应结构化表单。
- 按组织关系、业务边界、岗位知识包和 Skill 将任务拆分给对应团队。
- 建立任务账本，并向客户解释派发路径和当前状态。

### 6.8 组织与人力管理员

负责公司组织、岗位、AI 员工和客户可见性的配置。

核心职责：

- 维护公司、部门、中心、战队、岗位和 AI 员工组织结构。
- 为 AI 员工配置职责、审核通过的技能、联系人关系、个人记忆策略、成本基线和专用模型。
- 为 AI 员工配置岗位知识。
- 管理 AI 员工可读知识范围和岗位知识包绑定。
- 维护员工下线/离职流程；下线时清理个人记忆数据，但保留其知识资产作者归属。
- 维护考核规则，查看员工绩效数据、Token 消耗和记忆容量。
- 维护客户会员、客户角色、可见部门、可见员工、可咨询和可派活权限。
- 审核 AI 员工生成的知识草稿。
- 查看 AI 员工知识调用日志。

### 6.9 技能仓库管理员

负责管理 AI 员工可编排技能的生命周期。

核心职责：

- 维护技能编码、名称、部门、类型、等级、调用方式、输入输出 Schema、编排配置和安全规则。
- 审核人类维护或 AI 员工总结出来的技能；未审核通过的技能不能绑定到员工。
- 管控高级技能开放范围，高级技能只能由顶级管理人员维护、审核通过和绑定。
- 查看技能被哪些员工绑定，并在归档技能时同步禁用运行时绑定。

## 7. 产品架构

```text
数据源层
  文档上传 / Wiki 编辑 / 飞书钉钉企微 / Git / Jira / 会议纪要 / 邮件 / 工单
  ↓
人类管理层 硅基猿猴俱乐部管理台
  文档治理 / 权限 / 版本 / 审核 / 解析 / 人工校正 / 审计
  ↓
知识生产层
  清洗 / 切片 / 摘要 / 标签 / 实体抽取 / 关系抽取 / 质量检查
  ↓
LLM Wiki 层
  页面 / 模板 / 结构化字段 / 知识对象 / 关系 / 人机共读
  ↓
AI 员工平台
  客户登录 / 服务对话 / 聊天记录 / 业务前台 / 组织派发 / 员工直派 / 长任务恢复 / 多模态输出
  ↓
内部知识运行时
  运行时上下文 / Wiki 结构化读取 / RAG 检索 / 引用日志 / 任务记忆 / 知识沉淀入口
  ↓
RAG Memory 层
  chunk / embedding / 关键词索引 / 混合检索 / rerank / 权限过滤 / 引用日志
  ↓
知识运营层
  健康巡检 / 冲突处理 / 热度统计 / 过期治理 / 报告输出
```

## 8. 核心概念

### 8.1 文档

文档是知识来源，可能来自上传文件、外部系统或人工录入。

### 8.2 Wiki 页面

Wiki 页面是人机共读的知识表达单元，面向人类维护，也面向 AI 理解。

### 8.3 知识对象

知识对象是结构化知识单元，例如：

- 岗位职责
- SOP
- 业务规则
- 技术方案
- 决策记录
- 项目复盘
- FAQ
- 风险案例
- 模板

### 8.4 Chunk

chunk 是 RAG 检索和 AI 调用的最小内容单元，由 Wiki 页面或文档版本派生。

### 8.5 岗位知识管理

岗位知识管理是某类人类岗位或 AI 员工岗位的默认知识范围、工作规则和审批边界。它以 Wiki 页面为知识源，通过岗位规则和审核状态组织为可运行的岗位知识 profile。

### 8.6 知识健康

知识健康是对知识资产可用性、可信度、时效性、一致性、热度、风险的综合评估。

### 8.7 Worker Platform Runtime API

Worker Platform Runtime API 是面向客户端的 AI 员工运行期接口层。它不是后台管理 API，也不是知识服务直连入口，而是客户、内部人员和 AI 员工组织交互的统一通道。客户端从 `siliconApeClub-worker-front` 进入，只调用 `/api/worker-platform/**`，由 worker platform 在服务端内部调用 Knowledge Runtime、Task Memory、Retrieval 和管理台后端。

### 8.8 任务记忆

任务记忆是 AI 员工在一次任务执行过程中的上下文记录，包括任务目标、输入、检索 query、召回知识、最终引用、输出结果、人类反馈和是否成功。任务记忆默认不等于正式知识，但可以作为 Wiki 草稿和知识提案的证据来源。

### 8.9 Wiki 知识提案

Wiki 知识提案是 AI 员工或人类员工向正式 Wiki 提交的候选知识。它必须携带来源任务、证据、引用、适用部门、适用岗位、风险等级、建议模板和变更摘要。AI 员工不得直接写入 active Wiki，只能提交草稿或提案，经过审核后才能发布。

### 8.10 服务对话归档

服务对话是客户界面的基本单位，表现为一段可恢复的聊天。后端使用 `wp_demand_group` 作为内部归档和任务账本聚合结构，包含摘要、状态、参与员工、会话、任务、附件、产出物和知识沉淀候选，但前台页面不展示该内部表的旧业务名称。

### 8.11 会话与消息 Block

会话承载客户和 AI 员工的连续交互。消息不只是一段文本，而是由 typed block 组成，当前支持 `markdown`、`html`、`form`、`artifact`、`task_status`、`org_route`、`employee_card`、`handoff`。精准结构化输入优先走 `form`，HTML 只做受控展示。

### 8.12 系统快捷能力与对客业务表单

系统快捷能力是客户端展示给客户和内部人员的业务系统对客接口配置，由管理台 `系统快捷能力` 模块维护，不属于 AI 员工 Skill。它描述业务系统能力的分组、精确入参、展示 HTML、关键词、交易系统服务编码、动作码、启停、排序和外部/内部可见边界。

AI 员工 Skill 仍由技能仓库维护，面向员工执行能力、工具能力、岗位能力和 AI 员工经验沉淀；系统快捷能力面向客户交互和业务系统入口。两者可以在 worker platform 中协作，但配置权威源必须分离。

设计原则：

- 客户和内部人员默认可以先与 AI 员工自然聊天。
- 客户端不主动展示登记表，也不使用客户需求类默认标题；后端 `wp_demand_group` 只作为历史归档和任务账本内部结构。
- AI 员工识别到确定性业务意图时，输出对应 `form` block；不同任务使用不同表单模板。
- 客户也可以在客户端快捷能力区直接选择业务能力，跳过意图识别。
- 表单提交以结构化 values 为事实源；HTML 只做受控展示，不作为关键入参解析源。
- 下单、查询订单进度、查询服务地址、退货等传统业务系统能力可以不调用大模型，直接走表单提交和 `transactionServiceCode + actionCode` 业务动作。
- AI 员工负责服务把控、异常升级、组织派发、后续跟进和知识沉淀，而不是替代所有确定性业务接口。
- AI 员工可从重复任务中提炼新的执行 Skill 候选，写入技能仓库待审核；对客快捷能力仍由系统快捷能力模块配置和启停。

### 8.13 任务账本

任务账本记录 AI 员工执行任务的全生命周期，包括任务创建、组织派发、员工接手、事件、checkpoint、恢复、取消、转派、审核和知识沉淀。长任务恢复以任务账本为事实源。

## 9. 核心流程

### 9.1 知识生产流程

```text
创建或接入文档
  ↓
解析为中间产物
  ↓
人工校正或 AI 预处理
  ↓
生成 Wiki 页面或知识对象
  ↓
补充元数据、权限、适用岗位
  ↓
提交审核
  ↓
发布为 active 知识
  ↓
触发 RAG 索引
  ↓
AI 员工可检索调用
```

### 9.2 知识变更流程

```text
员工或 AI 提交修改
  ↓
生成新 Wiki 版本
  ↓
系统检测冲突、影响范围、权限变化
  ↓
知识负责人审核
  ↓
发布新版本
  ↓
旧版本进入历史
  ↓
触发增量索引
  ↓
更新同步账本
```

### 9.3 AI 员工平台任务接待与派发流程

```text
客户或内部人员登录 AI 员工平台
  ↓
开始或选择服务对话
  ↓
外部客户进入业务前台 / 内部人员选择前台或授权员工
  ↓
客户自然聊天，或从快捷能力区选择业务能力
  ↓
worker platform 写入会话和消息
  ↓
AI 员工识别确定性业务意图，或用户直接选择能力
  ↓
输出对应业务表单 form block，HTML 仅作为受控展示
  ↓
客户提交结构化 values
  ↓
确定性业务动作直接执行，并写入表单提交账本、任务账本和事件流
  ↓
业务前台按组织关系、部门职责、岗位知识包和 Skill 拆解派发
  ↓
目标 AI 员工加载身份、岗位、权限、任务上下文和历史记忆
  ↓
worker platform 内部调用 Knowledge Runtime、Retrieval 和 Task Memory
  ↓
AI 员工输出 markdown/form/html/artifact/task_status/org_route 等 block
  ↓
任务执行过程持续写入事件和 checkpoint
  ↓
服务重启或停电后按服务对话和任务账本恢复
  ↓
任务完成后生成产出物和候选 Wiki
  ↓
进入审核、发布和 RAG 同步流程
```

约束：

- 浏览器不直连 Knowledge Runtime、Task Memory、Retrieval。
- 外部客户默认由业务前台接待；如客户会员中心配置了可见部门和员工，客户端只展示授权范围。
- 内部人员对员工咨询或派活必须具备对应权限。
- 管理台 `ds_*`、`hr_*`、`customer_*` 是组织与客户权限权威配置；worker platform 的 `wp_*` 是运行时投影。
- 长任务的恢复依据是 worker platform 的任务账本和 checkpoint。

### 9.4 AI 员工反向沉淀 Wiki 流程

```text
AI 员工完成任务
  ↓
识别可复用知识、流程变化、缺失规则或冲突知识
  ↓
生成 task memory
  ↓
提交 Wiki draft / knowledge proposal
  ↓
携带来源任务、证据、引用、适用岗位、风险等级和建议模板
  ↓
知识负责人或知识管理员审核
  ↓
审核通过后发布为 active Wiki 新版本
  ↓
触发知识流水线
  ↓
生成 chunk、embedding、index record 和同步账本
  ↓
进入 RAG Memory，供后续 AI 员工检索调用
```

约束：

- AI 员工不能直接修改 active Wiki。
- AI 员工提交的知识默认是草稿或提案。
- 高风险知识必须经过人类二次审核。
- 未发布的 AI 沉淀知识不能被正式 RAG 调用。
- 所有 AI 知识提案必须可追溯到任务、证据和引用来源。

### 9.5 知识反馈流程

```text
人类或 AI 发现知识问题
  ↓
提交反馈
  ↓
系统归类为错误、过期、冲突、缺失、权限异常、检索异常
  ↓
进入知识健康问题池
  ↓
知识管理员或部门负责人处理
  ↓
修正知识或调整索引
  ↓
关闭问题并记录处理结果
```

## 10. 功能需求

### 10.1 人类管理层

#### 10.1.1 文档接入

支持：

- 上传 PDF、DOCX、PPTX、Markdown、TXT、SQL、LOG、HTML、图片等文件。
- 从企业系统同步文档。
- 从会议纪要、工单、项目管理系统接入知识来源。
- 保存源文件、解析结果、中间产物和版本。

验收标准：

- 每个文档有来源、版本、负责人、部门、状态、权限、解析状态。
- 每次解析结果可追溯到具体源文件版本。

#### 10.1.2 文档解析与人工校正

支持：

- 解析引擎配置化。
- 内置文本直读解析器，支持 Markdown、TXT、SQL、LOG、JSON、YAML、XML、配置文件和常见代码文件。
- 内置 HTML 转 Markdown 解析器，支持将网页结构转换为可进入 Wiki/RAG 的 Markdown。
- 查看解析中间产物。
- 人工校正 Markdown。
- 将校正结果生成 Wiki 页面草稿。

验收标准：

- 同一文档不同版本的解析结果互不覆盖。
- 人工校正内容进入知识生产流水线。

#### 10.1.3 知识审核与发布

支持：

- 草稿、待审核、已发布、已驳回、已废弃、已归档等状态。
- 知识负责人审核。
- 高风险知识必须二次审核。
- 发布后触发 RAG 索引。

验收标准：

- 未发布知识默认不能被 AI 员工正式引用。
- 发布记录可追溯到审核人、时间、版本、变更摘要。

### 10.2 LLM Wiki 层

#### 10.2.1 Wiki 页面

支持：

- 类 Notion/Confluence 的页面编辑。
- Markdown 与结构化字段混合编辑。
- 页面模板。
- 页面版本。
- 页面评论。
- 页面引用关系。
- 页面 AI 可用状态。
- Wiki 中心首页采用结构化工作台：左侧结构分组树、中间页面列表、右侧详情与关系图谱面板。
- 结构分组第一阶段支持 `部门 -> 页面类型 -> 状态` 与 `页面类型 -> 状态` 两种视图，并可与搜索、状态筛选组合使用。

页面必须展示：

- 知识状态
- 负责人
- 适用部门
- 适用岗位
- 权限策略名称、权限级别、绑定数量
- 最近更新时间
- RAG 同步状态
- 知识热度
- 健康问题数
- 关系数量

#### 10.2.2 知识模板

内置模板：

- 岗位说明书
- SOP
- 业务规则
- 技术方案
- 决策记录
- 项目复盘
- FAQ
- 风险案例
- 产品 PRD
- 测试报告
- 发布手册

验收标准：

- 每种模板有固定元数据字段。
- AI 员工可根据模板理解知识类型和使用场景。

#### 10.2.3 知识关系

支持：

- 页面引用页面。
- 页面属于岗位知识。
- 页面属于项目。
- 页面关联业务流程。
- 页面关联系统。
- 页面与页面存在冲突关系。
- 页面替代旧页面。

第一阶段关系类型固定为：

- `references`：引用。
- `depends_on`：依赖。
- `related_to`：相关。
- `supersedes`：替代旧页面。
- `duplicated_with`：重复或高度相似。

验收标准：

- 用户可以查看某个知识被哪些岗位包、AI 员工、任务引用。
- 系统可以识别孤岛知识和高风险依赖知识。
- 用户可以在 Wiki 页面详情中查看上游、下游、引用、依赖、相似、替代关系。
- 用户可以新增和删除 Wiki 页面关系，关系数据写入 `ks_wiki_relation`。

### 10.3 RAG Memory 层

#### 10.3.1 知识切片

支持：

- 按标题结构切片。
- 按段落语义切片。
- 按表格完整性切片。
- 按页面区块切片。
- 保留来源定位。

chunk 必须包含：

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
metadata
acl_policy_id
acl_version
security_level
knowledge_status
created_at
updated_at
```

说明：chunk 不应把展开后的 userIds 作为权限事实源。若为了性能冗余 userIds，只能作为索引缓存，必须通过权限版本和召回后强校验兜底。

#### 10.3.2 向量化与索引

支持：

- embedding 模型配置。
- chunk 增量向量化。
- 索引版本记录。
- 向量索引与关键词索引并存。
- 索引失败重试。
- 索引回滚。

验收标准：

- 每个 Wiki 页面显示已索引版本和最新页面版本是否一致。
- 索引滞后时 AI 员工可感知。

#### 10.3.3 混合检索

支持：

- 关键词检索。
- 向量检索。
- 结构化过滤。
- rerank。
- 权限预过滤。
- 召回后权限强校验。
- 引用结果解释。

检索请求必须携带：

```text
actor_type
actor_id
department_id
position_code
ai_employee_id
task_type
project_id
security_context
query
retrieval_policy
```

返回结果必须携带：

```text
chunk_id
source_title
source_version
wiki_page_id
wiki_page_version
knowledge_status
permission_matched_by
score
heat_score
trust_score
freshness_score
why_selected
```

### 10.4 Wiki 与 RAG 一致性

#### 10.4.1 同步账本

系统必须维护 Wiki 与 RAG 的同步账本。

记录：

```text
source_id
source_version
wiki_page_id
wiki_page_version
content_hash
chunk_strategy_version
chunk_count
embedding_model
embedding_version
index_version
index_status
indexed_at
index_error
```

#### 10.4.2 页面同步状态

Wiki 页面展示：

- 已同步
- 待同步
- 同步中

#### 10.4.3 删除一致性

文档管理中的文档是 LLM Wiki 与 RAG 的来源。删除文档时，系统必须同步清理该文档派生的 Wiki 和 RAG 内容：

- 管理员可以删除已发布或锁定文档；待审核文档需要先驳回再删除。
- 删除文档写入 `ds_document_audit` 和 `ks_pipeline_job(job_type=document_knowledge_delete)`。
- 关联 `ks_wiki_page` 标记为 `deleted`，正文和摘要清空，关系和岗位知识包引用移除。
- 关联 `ks_chunk` 标记为 `deleted`，chunk 文本、摘要和 embedding 清空。
- 关联 `ks_index_record` 标记为 `deleted`，避免 RAG 管理台和检索服务继续把旧索引视为可用内容。
- 同步失败
- 页面已更新但索引滞后
- 权限已更新但索引权限快照滞后
- 来源已废弃但 chunk 未清理

#### 10.4.3 AI 调用可回放

每次 AI 使用知识，记录：

- AI 员工
- 任务
- query
- 召回 chunk
- 最终引用 chunk
- 对应 Wiki 页面和版本
- 权限通过原因
- 模型输出
- 人类是否采纳
- 任务是否成功

验收标准：

- 当 AI 员工输出错误时，管理员可以回放它当时使用了哪些知识。

#### 10.4.4 AI 模型配置与真实调用

管理台 `系统设置 / AI 模型配置` 是模型接入的业务配置入口。

配置对象：

```text
profile_code
profile_name
provider
purpose
endpoint
api_key
model_name
dimensions
timeout_seconds
enabled
default_profile
fallback_enabled
config_json
```

首批用途：

| purpose | 用途 | 调用方 |
| --- | --- | --- |
| `document_to_wiki` | 文档解析后生成 LLM Wiki 摘要和正文 | `siliconApeClub-server` / Knowledge Pipeline |
| `rag_embedding` | Wiki、文档 chunk 向量化和 RAG 查询向量化 | `siliconApeClub-server`、`retrieval-service` |
| `rag_rerank` | RAG 检索结果重排 | `retrieval-service` |
| `worker_chat` | AI 员工对用户消息进行分析、回应和组织派发说明 | `siliconApeClub-worker-platform` |

产品规则：

- 有效配置为同一 `purpose` 下 `enabled=1` 且优先 `default_profile=1` 的配置。
- API key 由管理台维护，不在前端明文回显。
- 测试按钮必须能区分 `ok`、`not_configured`、`failed`，并给出可读原因。
- fallback 只用于开发期或显式允许的降级场景；fallback 结果必须在 metadata、chunk metadata 或调试信息中显式标记，不能伪装成真实模型调用成功。
- 浏览器不直接调用模型服务；AI 员工客户端只访问 worker platform。

验收标准：

- 文档生成 Wiki 时，流水线 metadata 能看到模型用途、供应商、模型名、是否真实调用和 fallback 原因。
- RAG chunk 和 RAG debug 能看到 embedding 模型、版本、是否 fallback。
- AI 员工聊天消息 metadata 能看到 `worker_chat` 模型调用状态。
- 系统设置修改模型配置后，后续调用按新配置生效。

### 10.5 知识权限体系

#### 10.5.1 权限主体

支持：

- USER
- ROLE
- DEPARTMENT
- POSITION
- PROJECT
- AI_EMPLOYEE
- AI_ROLE
- AI_TEAM

#### 10.5.2 权限动作

支持：

- view
- edit
- comment
- review
- publish
- archive
- use_in_rag
- use_in_ai_generation
- export
- manage_acl

#### 10.5.3 权限判断原则

1. Wiki 页面权限是源头权限。
2. chunk 保存 ACL 引用和权限版本。
3. 检索时做权限预过滤。
4. 召回后调用权限服务强校验。
5. 输出前记录引用审计。
6. 用户离职、调岗、禁用必须在身份权限服务实时生效，不依赖重建 chunk。

### 10.6 岗位知识管理

岗位知识管理用于支持逐岗替换，是 AI 员工上岗的核心配置。岗位知识不应脱离 Wiki 另造一套知识副本，而应以 Wiki 页面为权威源，通过岗位知识范围、必读标记、默认检索 scope、审批规则和权限边界组织成可绑定的岗位 runtime profile。

#### 10.6.1 岗位知识内容

包含：

- 岗位职责
- 工作范围
- 输入信息
- 输出交付物
- SOP
- 常用模板
- 常用系统
- 业务规则
- 判断标准
- 协作对象
- 审批边界
- 禁止事项
- 历史案例
- 绩效指标
- 人类接管条件
- 默认检索范围
- 默认引用规则
- 关联 Wiki 页面列表
- 必读 Wiki 标记
- Wiki 页面版本和 RAG 同步状态

#### 10.6.2 岗位知识状态

支持：

- 草稿
- 待审核
- 生效中
- 试运行
- 已废弃
- 已驳回
- 已归档

#### 10.6.3 AI 员工绑定

AI 员工必须绑定一个或多个岗位知识对象。绑定后，worker platform 在任务启动时通过内部 Knowledge Runtime 读取岗位知识下的 Wiki 页面集合、必读规则和默认检索范围，再生成 AI 员工任务启动上下文。

启动时加载：

- 岗位 Profile
- must-read 页面
- 默认检索 scope
- 权限边界
- 输出格式要求
- 审批规则
- 禁止事项

### 10.7 知识热度

#### 10.7.1 人类热度

指标：

- 浏览次数
- 搜索命中次数
- 收藏次数
- 评论次数
- 编辑次数
- 被引用次数
- 停留时间
- 最近更新时间

#### 10.7.2 AI 热度

指标：

- 被检索次数
- 被召回次数
- 被 rerank 选中次数
- 被最终引用次数
- 被用于成功任务次数
- 被用于失败任务次数
- 被人工纠错次数
- 被 AI 标记冲突次数

#### 10.7.3 综合评分

系统生成：

- usage_heat 使用热度
- trust_score 可信度
- freshness_score 新鲜度
- quality_score 质量分
- risk_score 风险分
- ai_success_score AI 成功贡献分

热度用于：

- 搜索排序
- RAG rerank 特征
- 推荐重点维护知识
- 发现无人维护但高价值知识
- 发现高频失败知识

### 10.8 知识健康巡检

系统自动识别：

- 过期知识
- 冲突知识
- 重复知识
- 孤岛知识
- 低热度低质量知识
- 高频失败知识
- 权限异常知识
- RAG 同步失败知识
- 索引滞后知识
- 负责人缺失知识
- 长期无人维护知识

每个健康问题包含：

```text
issue_id
issue_type
severity
related_page_id
related_chunk_id
owner
detected_by
detected_at
suggested_action
status
resolved_by
resolved_at
```

### 10.9 AI 员工 Worker Runtime 与内部知识接口

AI 员工平台必须提供面向客户端的 Worker Runtime API，并在服务端内部调用 Knowledge Runtime、Task Memory 和 Retrieval，避免客户端或 AI 员工直接耦合后台管理接口、RAG 内部索引或数据库。

#### 10.9.1 运行时上下文加载

支持：

- 根据 AI 员工身份加载部门、岗位、角色、项目和任务上下文。
- 加载绑定的岗位知识。
- 加载 must-read Wiki 页面。
- 加载默认 RAG 检索范围。
- 加载权限边界、审批规则、禁止事项和人类接管条件。

客户端接口：

```http
POST /api/worker-platform/auth/login
GET  /api/worker-platform/bootstrap
GET  /api/worker-platform/quick-capabilities
GET  /api/worker-platform/demand-groups
POST /api/worker-platform/demand-groups
GET  /api/worker-platform/sessions/{id}/messages
POST /api/worker-platform/sessions/{id}/messages
POST /api/worker-platform/sessions/{id}/quick-capabilities/{code}/open
GET  /api/worker-platform/tasks
POST /api/worker-platform/tasks/{id}/resume
GET  /api/worker-platform/org/employees
POST /api/worker-platform/org/employees/{id}/assign
```

内部知识接口：

```http
GET /api/ai-employees/{id}/runtime-context
GET /api/position-packages/{id}/runtime-profile
GET /api/wiki/pages/{id}/ai-readable
```

验收标准：

- AI 员工启动任务前可以一次性获得可用知识边界。
- 运行时上下文必须包含权限版本和岗位知识版本。
- 禁用、调岗、权限变化必须在下一次上下文加载时生效。

#### 10.9.2 任务检索与引用

支持：

- AI 员工按任务上下文调用 RAG 检索。
- 检索请求携带 actor、岗位、项目、任务、权限上下文。
- 返回结果携带 Wiki 页面、页面版本、chunk、索引版本、分数和 why_selected。
- AI 员工输出后写入 citation log。
- 系统记录 task memory，用于后续回放和知识沉淀。

建议接口：

```http
POST /api/retrieval/search
POST /api/retrieval/debug
POST /api/knowledge/citations
POST /api/task-memories
```

验收标准：

- 每次 AI 检索和引用均可回放。
- citation log 可追溯到 Wiki 页面版本、chunk 版本和索引版本。
- RAG 返回的内容必须经过权限预过滤和召回后强校验。
- 浏览器不直接调用 Retrieval 或 Task Memory。

#### 10.9.3 AI 反向沉淀 Wiki

支持：

- AI 员工提交知识反馈。
- AI 员工根据任务记忆生成 Wiki 草稿或知识提案。
- 知识提案携带来源任务、证据、引用、适用岗位、风险等级和建议模板。
- 知识负责人审核 AI 生成的 Wiki 草稿。
- 发布后自动触发 RAG 同步任务。

建议接口：

```http
POST /api/knowledge/feedback
POST /api/wiki/proposals
GET  /api/wiki/proposals/{id}
POST /api/wiki/proposals/{id}/approve
POST /api/wiki/proposals/{id}/reject
POST /api/task-memories/{id}/promote-to-wiki
POST /api/knowledge/sync-jobs
GET  /api/knowledge/sync-jobs/{id}
```

验收标准：

- AI 员工不能直接发布 active Wiki。
- AI 知识提案必须先进入审核流程。
- 审核通过的 Wiki 新版本必须进入同步账本。
- RAG 只能正式引用 active Wiki 派生出的 active chunk。

#### 10.9.4 AI 员工技能沉淀

支持：

- AI 员工或内部人员在任务过程中总结可复用技能。
- worker platform 将技能候选写入管理台技能仓库，状态为 `pending_review`，默认 `enabled=0`。
- 技能候选携带来源任务、来源员工、部门、技能类型、技能等级、输入输出 Schema、编排配置和安全规则。
- 技能仓库管理员审核通过后，技能才允许绑定到员工，并在 worker platform 重启或投影刷新后进入运行时 Skill。
- 高级技能候选只能由顶级管理人员提交、维护、审核和绑定。

客户端/运行期接口：

```http
POST /api/worker-platform/skills/proposals
GET  /api/admin/skill-repository?reviewStatus=pending_review
POST /api/admin/skill-repository/{id}/approve
POST /api/admin/skill-repository/{id}/reject
```

验收标准：

- AI 员工总结技能不能直接进入 `wp_worker_skill`。
- 未审核技能不能绑定到员工。
- 高级技能的维护、审核和绑定必须有后端权限校验。
- 技能通过审核后才能投影为可编排 Skill。

#### 10.9.5 系统快捷能力与对客业务表单

支持：

- 管理台新增 `系统快捷能力` 模块，维护 `client_quick_capability_group` 和 `client_quick_capability`。
- worker platform 通过 `GET /api/worker-platform/quick-capabilities` 向客户端投影启用且可见的快捷能力。
- 外部客户只看到 `visible_to_external=1` 的能力，内部人员只看到 `visible_to_internal=1` 的能力。
- 客户可通过快捷能力区打开表单，也可先自然聊天，由 AI 员工根据关键词和能力配置输出对应表单。
- 表单数据以 `form` block 的 `values` 字段提交，worker platform 写入 `wp_form_submission`。
- 确定性业务动作按 `transactionServiceCode + actionCode` 执行，结果写入 `wp_task_run`、`wp_task_event`、`wp_task_checkpoint`。
- 默认种子能力包括业务下单、查询订单进度、退货申请、查询服务地址。
- 后续真实交易系统接入时，只替换 worker platform 的业务动作适配器，不改客户端 form block 协议。

验收标准：

- 聊天输入“我要下单”等命中关键词时，AI 员工返回对应表单而不是立即建通用任务。
- 客户点击快捷能力时，当前会话出现对应表单。
- 表单提交后产生 `wp_form_submission` 记录和任务账本记录。
- 不同能力的字段、标题、提交按钮、展示 HTML、交易服务编码和动作编码均来自系统快捷能力配置。
- 未启用或对当前身份不可见的能力不能在客户端展示。

#### 10.9.6 接口安全原则

要求：

- AI 员工使用独立身份和 token。
- Runtime API 不暴露后台管理超级权限。
- 所有写操作必须记录 actor、任务、来源和审批状态。
- 高密级知识提案默认进入人工复核。
- 静默巡检窗口内，AI 员工只能提交草稿、反馈和任务记忆，不能发布正式知识。

## 11. 每日知识静默巡检机制

### 11.1 定义

每日固定 30 分钟进入知识静默巡检窗口。

在此期间，所有员工和 AI 员工停止对正式知识资产的新增、删除、发布和修改。知识管理员集中处理冲突、过期、同步失败、权限异常和健康问题，并输出知识健康报告。

建议命名：知识静默窗口。

### 11.2 目标

1. 给企业知识资产留出稳定维护时间。
2. 避免知识边生产边治理导致冲突扩大。
3. 让知识管理员每天有固定节奏修复知识质量。
4. 让全公司对知识资产健康形成共同意识。
5. 让 AI 员工使用的知识在每日巡检后达到更高可信度。

### 11.3 窗口状态

平台进入 `MAINTENANCE_WINDOW` 状态。

规则：

- 普通员工不能新建、删除、发布、修改正式知识。
- 普通员工可以阅读知识。
- 普通员工可以提交反馈，但反馈进入队列。
- AI 员工不能写入正式知识。
- AI 员工可以读取 active 知识，但高风险任务应提示当前处于巡检窗口。
- 知识管理员可以修改、合并、废弃、发布知识。
- 部门知识负责人可以在授权范围内协助处理。
- 外部系统同步进入暂存队列，不直接发布。
- 紧急修复可走 emergency override，但必须审计。

### 11.4 每日巡检流程

```text
巡检前 10 分钟
  系统通知全员和 AI 员工即将进入静默窗口
  ↓
进入静默窗口
  锁定普通知识写入
  暂停自动发布
  生成待处理问题清单
  ↓
知识管理员处理
  冲突合并
  过期废弃
  权限修正
  同步失败重试
  高风险知识复核
  ↓
重新索引
  增量生成 chunk
  更新 embedding
  刷新权限版本
  更新同步账本
  ↓
生成知识健康报告
  输出全局健康分
  输出问题处理情况
  输出遗留风险
  输出明日重点
  ↓
退出静默窗口
  恢复普通写入
  发布报告
```

### 11.5 知识健康报告

日报内容：

- 今日知识健康总分
- 新增知识数
- 修改知识数
- 发布知识数
- 废弃知识数
- 处理冲突数
- 新发现冲突数
- 过期知识数
- RAG 同步失败数
- 索引滞后数
- 权限异常数
- AI 高频引用知识 Top 10
- AI 高频失败知识 Top 10
- 人类高热知识 Top 10
- 无负责人高风险知识
- 今日修复摘要
- 明日待处理问题

示例：

```text
知识健康日报 2026-06-20

全局健康分：82 / 100
今日处理冲突：12 个
仍有高风险冲突：3 个
RAG 同步失败：2 个
索引滞后页面：7 个
AI 高频失败知识：CRM 客户分层规则 v4
建议明日重点：更新产品发布流程与客户分层规则
```

### 11.6 异常机制

如果业务要求不能全员停止知识变更，系统允许设置分级窗口：

- 全公司窗口
- 部门窗口
- 项目窗口
- 高风险知识窗口

MVP 默认支持全局窗口，后续扩展到部门和项目。

## 12. 页面设计

### 12.1 知识首页

展示：

- 知识健康总分
- 今日待处理问题
- 待审核知识
- 同步失败知识
- 热门知识
- 高频失败知识
- 岗位知识状态
- 巡检窗口倒计时

### 12.2 Wiki 中心

展示：

- 左侧结构分组树，支持按部门、页面类型、状态聚合。
- 中间 Wiki 页面列表，展示标题、类型、部门、状态、RAG 同步状态、ACL 策略、版本和更新时间。
- 右侧页面详情，支持编辑、保存、发布、归档、删除。
- 正文
- 元数据
- 权限策略名称、密级和绑定数量，并可跳转 RAG 管理台查看策略。
- 适用岗位
- AI 可用状态
- RAG 同步状态
- 热度
- 健康问题
- 关系图谱，展示入向/出向关系并支持新增、删除关系。
- 版本历史
- AI 引用记录

### 12.3 岗位知识管理页面

展示：

- 岗位说明
- 必读知识
- 默认检索范围
- 输出模板
- 审批规则
- 绑定 AI 员工
- 最近使用情况
- 包内知识健康状态
- 可勾选的 Wiki 页面
- 草稿、待审核、审核通过、驳回、归档、删除等状态动作

### 12.4 知识健康中心

展示：

- 健康问题池
- 冲突知识
- 过期知识
- 同步异常
- 权限异常
- 低质量知识
- 高频失败知识
- AI 知识提案审核队列
- 任务记忆沉淀候选
- 巡检任务
- 健康报告历史

### 12.5 RAG 管理台

展示：

- 输入 query
- 选择 actor 身份
- 选择岗位知识
- 查看权限过滤结果
- 查看召回 chunk
- 查看 rerank 结果
- 查看最终引用
- 查看为什么选中或未选中
- 查看最近入库 active chunk
- 管理 chunk 的 ACL 策略、部门标签、岗位标签、知识状态和密级
- 查询/创建/启停 `ks_acl_policy`
- 查询/新增/删除 `ks_acl_binding`
- 通过 `siliconApeClub-server` 代理调用 `/api/retrieval/debug`，避免前端跨域直连 retrieval-service

### 12.6 AI 员工知识运行时视图

展示：

- AI 员工身份
- 绑定岗位知识
- runtime context
- must-read Wiki
- 默认检索 scope
- 最近任务记忆
- 最近 citation log
- 已提交 Wiki proposal
- 被驳回或待审核知识沉淀

## 13. 数据模型建议

### 13.1 核心表

```text
knowledge_source
knowledge_page
knowledge_page_version
knowledge_object
knowledge_chunk
knowledge_acl_policy
knowledge_acl_binding
knowledge_index_record
knowledge_sync_job
knowledge_position_package
knowledge_position_package_item
knowledge_usage_event
knowledge_heat_stat
knowledge_citation_log
knowledge_feedback
knowledge_runtime_session
knowledge_task_memory
knowledge_wiki_proposal
knowledge_wiki_proposal_evidence
knowledge_health_issue
knowledge_health_report
knowledge_maintenance_window
```

### 13.2 权限表设计原则

不建议在 chunk 上长期维护展开后的 userIds。

建议：

```text
knowledge_acl_policy
  id
  policy_name
  security_level
  acl_version
  status

knowledge_acl_binding
  policy_id
  principal_type
  principal_id
  action
  effect

knowledge_chunk
  acl_policy_id
  acl_version
  security_level
  stable_permission_tags
```

用户离职、调岗、禁用时，只更新身份权限服务和 ACL 版本，不批量修改所有 chunk。chunk 索引异步刷新，召回后权限强校验兜底。

## 14. 技术架构建议

### 14.1 MVP 架构

```text
前端
  React / Vite / TypeScript

后端
  Spring Boot 继续承载文档、权限、审核、知识管理

知识处理 Worker
  Java Worker 或 Python Worker

主库
  PostgreSQL

向量库
  pgvector 优先，后续可切 Milvus / Qdrant

关键词检索
  OpenSearch 可后置，MVP 可先用数据库全文索引

对象存储
  MinIO

消息队列
  RocketMQ

缓存
  Redis

大模型接口
  Embedding Provider / Rerank Provider / LLM Provider 可配置
```

### 14.2 中长期架构

```text
Silicon Ape Club Knowledge API
  ↓
Knowledge Pipeline Service
  ↓
Knowledge Index Service
  ↓
RAG Retrieval Service
  ↓
AI Employee Memory API
```

建议将 RAG Retrieval Service 独立成服务，避免文档管理系统和 AI 检索引擎耦合过深。

## 15. 权限与安全

安全要求：

- AI 员工必须拥有明确身份。
- AI 员工不能使用超级权限默认读取所有知识。
- 所有 AI 检索必须记录日志。
- 所有 AI 引用必须能追溯到来源版本。
- 高密级知识默认不可用于 AI 生成，除非显式授权。
- 权限变化必须立即影响新请求。
- 旧索引权限滞后时，召回后强校验必须阻断越权内容。
- 离职用户禁用后立即失去访问能力。

## 16. 成功指标

### 16.1 知识质量指标

- active 知识占比
- 过期知识占比
- 冲突知识数量
- 无负责人知识数量
- 知识平均更新时间
- 知识健康总分

### 16.2 AI 使用指标

- AI 检索成功率
- AI 引用覆盖率
- AI 输出引用率
- AI 因知识错误导致失败的任务比例
- AI 高频失败知识数量
- AI 使用过期知识次数

### 16.3 运营指标

- 每日巡检完成率
- 健康问题关闭率
- 平均问题处理时长
- 部门知识包完整度
- 岗位知识覆盖率
- 知识管理员处理效率

## 17. MVP 交付计划

### 阶段一：知识模型与真实 RAG 同步

目标：让硅基猿猴俱乐部管理台从 RAG 状态占位升级为真实知识索引。

交付：

- knowledge_page
- knowledge_chunk
- knowledge_index_record
- knowledge_sync_job
- chunk 生成
- embedding
- 基础检索
- 页面同步状态

### 阶段二：权限与引用追溯

目标：让 AI 员工安全、可解释地读取知识。

交付：

- 知识 ACL
- AI 员工身份
- 内部 Knowledge Runtime API
- AI 员工运行时上下文加载
- 检索权限过滤
- 召回后强校验
- citation log
- task memory 基础记录
- RAG 管理台基础版

### 阶段三：岗位知识管理

目标：支撑逐岗替换。

交付：

- 岗位知识管理
- AI 员工绑定岗位包
- must-read 页面
- 默认检索范围
- 审批规则
- 禁止事项
- 岗位 runtime profile

### 阶段四：知识健康中心

目标：建立知识资产长期运营机制。

交付：

- 知识健康问题池
- 冲突检测
- 过期检测
- 同步异常检测
- 热度统计
- 健康报告
- 每日知识静默窗口
- AI 知识反馈与 Wiki proposal 审核队列

### 阶段五：AI 员工平台组织化交付

目标：让客户和内部人员通过 AI 员工平台发起服务对话，并由业务前台按组织关系派发给 AI 员工团队。

交付：

- `siliconApeClub-worker-front`
- `siliconApeClub-worker-platform`
- 客户登录鉴权
- 服务对话与历史会话
- 业务前台 AI 员工
- 管理台组织与人力中心
- 客户会员中心与客户可见性
- 组织关系与员工权限运行时投影
- 员工咨询与直派
- 多模态消息 block
- 长任务账本、事件和 checkpoint
- 候选 Wiki 发起

### 阶段六：企业级扩展

目标：连接真实企业系统，进入组织运行。

交付：

- 飞书/钉钉/企微同步
- Git/Jira/工单系统接入
- 项目记忆
- 任务记忆
- AI 员工知识反馈闭环
- task memory 到 Wiki 的沉淀策略

## 18. 风险与对策

| 风险 | 说明 | 对策 |
| --- | --- | --- |
| Wiki 与 RAG 不一致 | 人看到的是新知识，AI 用的是旧索引 | 同步账本、页面状态、索引水位、引用日志 |
| 权限越权 | AI 检索到不该看的内容 | 权限预过滤 + 召回后强校验 + 审计 |
| 知识治理成本高 | 知识管理员工作量过大 | 自动检测、优先级排序、每日巡检窗口 |
| 文档质量低 | 源头文档混乱导致 AI 效果差 | 解析校正、模板化、审核、质量分 |
| 员工不维护知识 | 知识资产无法长期健康 | 巡检制度、部门负责人、健康报表、绩效关联 |
| RAG 黑盒 | AI 做错事无法定位原因 | RAG 管理台、引用回放、任务日志 |
| AI 沉淀污染正式知识 | AI 将未经验证的经验直接写入知识源 | Wiki proposal 审核、人类复核、风险等级、发布后再同步 RAG |

## 19. 结论

企业知识层是硅基猿猴俱乐部的基础设施。没有高质量知识资产，AI 员工只能成为看似聪明但不可控的工具；有了可治理、可追溯、可持续维护的知识层，AI 员工才可能逐步接管岗位工作。

原 DocSpace 的工程基础应保留，但产品边界必须升级：从文档管理系统升级为硅基猿猴俱乐部管理台与企业知识资产平台；从 RAG 同步按钮升级为知识生产流水线；从人类文档权限升级为人类与 AI 员工统一权限；从不可见的向量索引升级为可观测、可巡检、可回放的 RAG Memory。

最终目标是形成一套高质量企业知识资产，让知识不再散落在个人经验和零散文档中，而成为公司运行、AI 员工协作和组织硅基化转型的核心基石。
