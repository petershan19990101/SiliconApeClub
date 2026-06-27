# Knowledge Runtime Service

AI 员工访问知识层的运行时入口。

职责：

- 加载 AI 员工 runtime context。
- 聚合岗位知识管理 profile、must-read Wiki、默认检索范围和权限边界。
- 提供 AI 可读 Wiki 页面接口。
- 接收知识反馈和 Wiki proposal。
- 审核通过 proposal 后写入 active Wiki 并触发同步任务。

本服务 MVP 直接连接硅基猿猴俱乐部知识层 PostgreSQL，共享知识层事实源。
