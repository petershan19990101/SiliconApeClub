# DocSpace Server

`docspace-server` 是与 `docspace-front` 平级的后端项目，采用以下技术栈：

- Java 8
- Spring Boot 2.2.x
- Spring Security
- Spring Validation
- MyBatis-Plus
- PostgreSQL + pgvector
- Redis
- RocketMQ
- MinIO
- Flyway
- Swagger(OpenAPI)
- Apollo Client（可选接入配置中心，见 `application.yml` 中 `apollo.*`）

## 当前实现范围

- JWT 登录鉴权
- 部门、用户、目录、文档、版本、审计、权限的核心模型
- 文档上传、校正、重新解析、RAG 同步、提交审核、驳回、发布、修订、锁定/解锁
- Wiki 页面、知识同步任务、岗位知识包、AI 员工、知识健康巡检
- Dashboard 统计、活动流、搜索接口
- PostgreSQL 表结构、pgvector 扩展与基础种子数据
- MinIO/RocketMQ/Redis 的可开关集成骨架

## 默认演示账号

- 管理员：`admin` / `Admin@123`
- 普通成员：`member` / `Member@123`

## 启动依赖

建议从 `docspaceV2` 根目录启动完整 MVP 依赖：

```bash
docker compose up -d
```

`docspace-server/docker-compose.yml` 仅保留基础中间件入口；完整服务编排请使用仓库根目录的 `docker-compose.yml`。

## 本地运行

```bash
./mvnw spring-boot:run
```

Windows:

```powershell
.\mvnw.cmd spring-boot:run
```

## 关键地址

- Swagger UI: `http://localhost:8080/swagger-ui/index.html`
- OpenAPI JSON: `http://localhost:8080/v3/api-docs`

## 环境变量

可参考 `.env.example` 或直接覆盖 `application.yml` 中的默认值。

### Apollo（可选）

默认 `APOLLO_BOOTSTRAP_ENABLED=false`，不连 Meta。接入 Apollo 时设置 `APOLLO_BOOTSTRAP_ENABLED=true`，并配置 `APOLLO_META`、`APOLLO_APP_ID`（与 Portal 中应用 ID 一致）；可在 Portal 中维护 `application` 等命名空间配置，覆盖本地 `application.yml` 中的同名项。
