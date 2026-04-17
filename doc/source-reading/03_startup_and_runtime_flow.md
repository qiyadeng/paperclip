# 03 启动入口与运行时流程

## 启动入口总览

主要有三种入口：

1. 开发入口：`pnpm dev`
2. CLI 一键入口：`paperclipai run`
3. 后端直接入口：`@paperclipai/server` 的 `startServer()`

Root scripts：

```json
{
  "dev": "pnpm --filter @paperclipai/server exec tsx ../scripts/dev-runner.ts watch",
  "dev:once": "pnpm --filter @paperclipai/server exec tsx ../scripts/dev-runner.ts dev",
  "paperclipai": "node cli/node_modules/tsx/dist/cli.mjs cli/src/index.ts"
}
```

## CLI 启动路径

入口文件：`cli/src/index.ts`

注册的主要命令：

- `paperclipai onboard`
- `paperclipai doctor`
- `paperclipai configure`
- `paperclipai run`
- `paperclipai heartbeat run`
- `paperclipai auth bootstrap-ceo`
- client commands：company、issue、agent、approval、activity、dashboard、routine、plugin 等

`paperclipai run` 的主要流程在 `cli/src/commands/run.ts`：

```text
paperclipai run
→ resolve home/instance/config path
→ load env/config
→ 如果没有 config，执行 onboard()
→ doctor --repair
→ dynamic import server/src/index.ts 或 @paperclipai/server
→ startServer()
```

## Server 启动路径

后端入口：`server/src/index.ts`

核心导出：

```ts
export async function startServer(): Promise<StartedServer>
```

启动流程按顺序理解：

1. `loadConfig()` 加载配置。
2. 初始化 telemetry。
3. 设置 secrets 相关 env 默认值。
4. 初始化数据库：
   - 如果有 `DATABASE_URL`，使用外部 PostgreSQL。
   - 如果没有，启动 embedded PostgreSQL。
5. 检查/应用 migrations。
6. 根据 deployment mode 初始化 board principal 或 better-auth。
7. 自动探测可用端口。
8. 创建 storage service。
9. 调用 `createApp()` 创建 Express app。
10. 创建 HTTP server。
11. 设置 WebSocket live events。
12. 启动 heartbeat/routine scheduler。
13. 启动数据库备份定时器。
14. 等待 external adapters 加载完成。
15. `server.listen()`。
16. 注册 SIGINT/SIGTERM 优雅关闭 embedded PostgreSQL 和 telemetry。

## Express app 构建路径

Express app 在：`server/src/app.ts`

`createApp(db, opts)` 主要做：

1. `express.json()`，保存 rawBody。
2. `httpLogger`。
3. private hostname guard。
4. `actorMiddleware`：解析 board/agent actor。
5. auth route：`/api/auth/get-session`、better-auth handler。
6. 创建 `/api` Router。
7. `boardMutationGuard()`。
8. 挂载各领域 API routes。
9. 初始化 plugin worker/registry/scheduler/tool dispatcher/lifecycle。
10. 挂载 plugin routes。
11. 挂载 adapter routes。
12. 挂载 access routes。
13. `/api` 404 handler。
14. plugin UI static routes。
15. 根据 `uiMode` 提供静态 UI 或 Vite dev middleware。
16. `errorHandler`。
17. 启动 plugin job coordinator、scheduler、loader、dev watcher。

## API route 注册

`app.ts` 中 `/api` 下挂载：

```text
/api/health
/api/companies
/api/company-skills
/api/agents
/api/assets
/api/projects
/api/issues
/api/routines
/api/execution-workspaces
/api/goals
/api/approvals
/api/secrets
/api/costs
/api/activity
/api/dashboard
/api/sidebar-badges
/api/sidebar-preferences
/api/inbox-dismissals
/api/instance-settings
/api/plugins
/api/adapters
/api/access-related routes
```

## UI 启动与路由

UI 入口：`ui/src/App.tsx`

关键点：

- `CloudAccessGate` 先调用 `/api/health` 判断 deployment mode。
- authenticated mode 会检查 session。
- bootstrap pending 时显示 first admin invite 提示。
- board 页面通过 `Layout` 包起来。
- 大部分业务页面以 `/:companyPrefix/...` 作为路径。

典型页面：

```text
/:companyPrefix/dashboard
/:companyPrefix/agents
/:companyPrefix/issues
/:companyPrefix/projects
/:companyPrefix/goals
/:companyPrefix/approvals
/:companyPrefix/costs
/:companyPrefix/activity
/:companyPrefix/inbox
```

## 后台调度链路

在 `server/src/index.ts` 中，如果 `config.heartbeatSchedulerEnabled`：

- 启动时：
  - `reapOrphanedRuns()`
  - `resumeQueuedRuns()`
  - `reconcileStrandedAssignedIssues()`
- 定时器中：
  - `heartbeat.tickTimers(new Date())`
  - `routine.tickScheduledTriggers(new Date())`
  - 周期性 recovery

这说明 heartbeat 执行既支持手动/API 触发，也支持后台定时触发和恢复。

## 启动流程改造关注点

如果后续改造启动/部署/鉴权/数据库，优先关注：

- `server/src/config.ts`
- `server/src/index.ts`
- `server/src/app.ts`
- `cli/src/commands/onboard.ts`
- `cli/src/commands/run.ts`
- `doc/DEPLOYMENT-MODES.md`
- `doc/DATABASE.md`

风险点：启动流程同时处理 DB、migration、auth、storage、UI、scheduler、plugin，复杂度较高；deployment mode 和 exposure 会影响 auth、hostname guard、session、bootstrap。
