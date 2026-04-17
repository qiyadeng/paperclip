# 02 目录结构与模块边界

## 顶层目录职责

```text
source/
├── server/                 # 后端 API、业务服务、调度、插件、认证、存储
├── ui/                     # React Board UI
├── cli/                    # paperclipai 命令行工具
├── packages/
│   ├── db/                 # Drizzle schema/migrations/db client
│   ├── shared/             # 共享类型、validators、常量
│   ├── adapter-utils/      # adapter 通用工具
│   ├── adapters/           # 内置 agent adapters
│   ├── plugins/            # 插件 SDK、插件脚手架、示例插件
│   └── mcp-server/         # MCP server 包
├── doc/                    # 产品、规格、数据库、开发、部署文档
├── docs/                   # 面向用户的文档站点
├── docker/                 # docker compose、镜像、smoke 配置
├── scripts/                # dev runner、release、smoke、维护脚本
├── tests/                  # e2e / release smoke 测试
└── skills/                 # Paperclip skills
```

## 后端 `server/src`

```text
server/src/
├── index.ts                # 进程入口：配置、DB、迁移、auth、server listen、scheduler
├── app.ts                  # Express app：中间件、API routes、UI 静态/Vite、插件启动
├── config.ts               # runtime config 加载
├── auth/                   # better-auth 相关封装
├── middleware/             # logger、auth actor、error handler、guard、validate
├── routes/                 # HTTP API 路由层
├── services/               # 业务服务层
├── adapters/               # server 侧 adapter registry、HTTP/process adapter
├── realtime/               # WebSocket live events
├── storage/                # local/S3 存储抽象
├── secrets/                # secret provider/encryption
└── __tests__/              # Vitest 单元/集成测试
```

### 后端边界理解

- `routes/`：负责 HTTP 参数、actor/authz、请求校验、调用 service、组装响应。
- `services/`：负责主要业务逻辑和数据库操作。
- `packages/db`：定义 schema、migration、DB client，不应承载复杂业务规则。
- `packages/shared`：定义 API contract，前后端共享。
- `adapters/`：把统一 heartbeat 执行协议转成具体 agent runtime 调用。

后续改造时，如果改变一个业务字段/接口，通常要同步改：

```text
packages/db schema
→ packages/shared types/validators
→ server routes/services
→ ui api/pages/components
→ tests
```

## 前端 `ui/src`

```text
ui/src/
├── App.tsx                 # 路由总入口
├── api/                    # fetch API client，每个领域一个文件
├── pages/                  # 页面级组件
├── components/             # 可复用业务组件和 UI 组件
├── context/                # Company/Dialog 等上下文
├── hooks/                  # 自定义 hooks
├── lib/                    # queryKeys、router、工具函数
├── adapters/               # UI 侧 adapter metadata/config form/transcript 适配
└── plugins/                # UI 插件 runtime/bridge
```

前端路由有明显 company prefix：

```text
/:companyPrefix/dashboard
/:companyPrefix/agents
/:companyPrefix/issues
/:companyPrefix/projects
/:companyPrefix/goals
/:companyPrefix/approvals
/:companyPrefix/costs
```

## 数据层 `packages/db/src`

```text
packages/db/src/
├── client.ts               # createDb
├── migrate.ts              # migration 执行
├── migration-runtime.ts    # migration runtime
├── embedded-postgres-*     # embedded PG 支持
├── migrations/             # SQL migration 文件
└── schema/                 # Drizzle 表定义
```

重要 schema：

- `companies.ts`
- `agents.ts`
- `goals.ts`
- `projects.ts`
- `issues.ts`
- `issue_comments.ts`
- `heartbeat_runs.ts`
- `approvals.ts`
- `cost_events.ts`
- `budget_policies.ts`
- `activity_log.ts`
- `plugins.ts` / `plugin_*`

## 共享契约 `packages/shared/src`

```text
packages/shared/src/
├── types/                  # TS 类型
├── validators/             # Zod validators
├── api.ts                  # API path/contract 常量
├── constants.ts            # 共享常量
├── adapter-type.ts         # adapter type 相关
└── telemetry/              # telemetry client/types/events
```

这是前后端契约中心。改造 API、payload、状态枚举时，优先检查这里。

## Adapter 模块

内置 adapter 位于：

```text
packages/adapters/
├── claude-local/
├── codex-local/
├── cursor-local/
├── gemini-local/
├── openclaw-gateway/
├── opencode-local/
└── pi-local/
```

server 侧统一注册在：

```text
server/src/adapters/registry.ts
```

## 插件系统模块

插件相关后端服务集中在：

```text
server/src/services/plugin-*.ts
```

主要能力：plugin registry、loader、lifecycle、worker manager、job scheduler、tool dispatcher、event bus、host services、UI static routes。

如果改造目标是“扩展能力”，优先考虑是否应接插件系统，而不是直接改 core。
