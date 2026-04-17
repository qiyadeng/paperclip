# 06 API 与外部集成初读

## API 基础

- API base path：`/api`
- API route 注册：`server/src/app.ts`
- API route 实现：`server/src/routes/*.ts`
- 前端 API client：`ui/src/api/client.ts`
- 前端领域 API：`ui/src/api/*.ts`
- 共享 validators：`packages/shared/src/validators/*`
- 共享 types：`packages/shared/src/types/*`

## 前端 API client

`ui/src/api/client.ts` 统一封装：

- base：`/api`
- `credentials: "include"`
- 默认 `Content-Type: application/json`
- 非 2xx 抛 `ApiError`
- 支持 get/post/postForm/put/patch/delete

## 主要 API 分组

| 分组 | 路由文件 | 说明 |
|---|---|---|
| health | `health.ts` | 健康检查、部署模式、bootstrap 状态 |
| companies | `companies.ts` | company CRUD、导入导出、branding |
| agents | `agents.ts` | agent CRUD、org、adapter config、heartbeat 等 |
| projects | `projects.ts` | project CRUD、workspace、runtime controls |
| issues | `issues.ts` | issue CRUD、checkout、comments、documents、work products |
| goals | `goals.ts` | goal CRUD |
| approvals | `approvals.ts` | approval CRUD、approve/reject/resubmit/comments |
| costs | `costs.ts` | cost events、budget、summary、finance |
| activity | `activity.ts` | activity feed、run/issues 查询 |
| secrets | `secrets.ts` | company secrets、rotate、provider |
| plugins | `plugins.ts` | plugin install/enable/config/jobs/tools/webhooks/UI |
| adapters | `adapters.ts` | adapter install/disable/config schema/ui parser |
| access | `access.ts` | board claim、CLI auth、invites、members、join requests |

## 典型 API 设计模式

典型模式：

```ts
router.post(
  "/companies/:companyId/issues",
  validate(createIssueSchema),
  async (req, res) => {
    // 1. 解析 actor
    // 2. assertCompanyAccess
    // 3. 调 service
    // 4. 写 activity / wakeup / telemetry
    // 5. 返回 JSON
  }
)
```

常见中间件/工具：

- `validate()`：Zod body 校验。
- `actorMiddleware()`：注入 `req.actor`。
- `assertCompanyAccess()`：company-scoped 权限。
- `boardMutationGuard()`：board mutation 保护。
- `errorHandler()`：统一错误响应。

## Auth / Access

相关文件：

```text
server/src/middleware/auth.ts
server/src/auth/better-auth.ts
server/src/routes/authz.ts
server/src/routes/access.ts
server/src/agent-auth-jwt.ts
```

模式：

- `local_trusted`：本地 trusted board，隐式 local board principal。
- `authenticated`：better-auth session。
- Agent：bearer API key / JWT 类访问。

AGENTS.md 明确要求：

- Board access = full-control operator context。
- Agent access uses bearer API keys，hashed at rest。
- Agent keys must not access other companies。

## 外部集成点

### Agent runtimes

通过 adapters：

- Claude Code
- Codex
- Cursor
- Gemini
- OpenCode
- Pi
- OpenClaw Gateway
- Hermes
- process
- http
- external plugin adapters

### 数据库

- External PostgreSQL via `DATABASE_URL`
- Embedded PostgreSQL local default
- Supabase/Postgres-compatible hosted DB

### 存储

从文档看支持：

- local disk
- S3-compatible object storage

相关目录：`server/src/storage/`

### 插件

插件系统通过：worker RPC、host services、plugin jobs、tool dispatcher、webhooks、UI static routes/contributions。

## 改造 API 时的检查清单

如果新增或修改 API：

1. `packages/shared/src/types/*` 是否要改？
2. `packages/shared/src/validators/*` 是否要改？
3. `server/src/routes/*` 是否使用了 `validate()`？
4. 是否做了 `assertCompanyAccess()`？
5. agent actor 是否需要额外权限限制？
6. 是否需要写 `activityLog`？
7. 是否影响 UI API client？
8. 是否需要补 Vitest route/service 测试？
9. 是否需要更新 docs/spec？

## 需要重点追踪的接口链路

后续建议优先逐行解读：

1. `POST /api/companies/:companyId/issues`
2. `POST /api/issues/:id/checkout`
3. `POST /api/issues/:id/comments`
4. agent heartbeat 触发相关接口
5. approval approve/reject 接口
6. cost event ingestion 接口
