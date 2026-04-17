# 源码解读计划

> 目标：先建立对项目的整体认知，再定位核心链路与可改造点。后续所有源码解读文档建议统一放在本目录下。

## 当前源码状态

- 已 clone：`https://github.com/qiyadeng/paperclip.git`
- 本地源码目录：`/workspace/project/source`
- 当前分支：`master`
- 当前提交：`e93e418c fix: add ssh client and jq to production image (#3826)`

## 已创建解读文档

- `01_project_overview.md`：项目全景与技术栈
- `02_directory_and_modules.md`：目录结构与模块边界
- `03_startup_and_runtime_flow.md`：启动入口与运行链路
- `04_core_business_flows.md`：核心业务链路初读
- `05_data_model_and_persistence.md`：数据模型与持久化初读
- `06_api_and_integrations.md`：API 与外部集成初读
- `07_agent_scheduling_and_issue_creation.md`：Agent 调度与 Issue 创建机制
- `08_company_and_agent_skills.md`：Company / Agent Skills 机制解读
- `09_org_design_and_agent_prompts.md`：推荐组织架构与 Agent Prompt 设计
- `10_human_agent_interaction.md`：人类与 Agent 的交互机制


## 建议优先解读的方面

1. **项目全景与技术栈**
   - 项目解决什么问题、主要模块有哪些。
   - 使用的语言、框架、构建工具、包管理方式。
   - 启动方式、开发/测试/生产环境差异。

2. **目录结构与模块边界**
   - 每个顶层目录的职责。
   - 模块之间的依赖关系。
   - 哪些模块是核心业务，哪些是基础设施或适配层。

3. **启动入口与运行时流程**
   - 程序入口在哪里。
   - 初始化流程：配置加载、依赖注入、路由注册、任务启动等。
   - 一次请求、任务或事件从入口到输出的完整路径。

4. **核心业务模型与关键流程**
   - 核心实体、领域对象、状态流转。
   - 主要业务用例的调用链。
   - 业务规则、边界条件和异常分支。

5. **数据层与持久化设计**
   - 数据库表结构、迁移脚本、ORM/DAO/Repository。
   - 缓存、事务、锁、分页、索引相关逻辑。
   - 数据读写的一致性和性能风险。

6. **接口/API/外部集成**
   - 对外暴露的 HTTP/RPC/CLI/SDK 接口。
   - 第三方服务、消息队列、对象存储等集成点。
   - 输入校验、错误码、兼容性约束。

7. **横切能力**
   - 鉴权、权限、日志、异常处理、监控、配置、安全策略。
   - 这些能力是否集中封装，是否存在重复实现。

8. **测试、CI 与质量保障**
   - 单元测试、集成测试、端到端测试覆盖哪些场景。
   - 本地如何运行测试和格式化检查。
   - 当前测试能否支撑后续改造。

9. **改造风险与切入点**
   - 高耦合、高复杂度、缺测试、历史兼容逻辑。
   - 可优先重构的低风险模块。
   - 改造前需要补充的测试或观测手段。

## 建议文档结构

```text
docs/source-reading/
├── 00_reading_plan.md                 # 解读计划与索引
├── 01_project_overview.md             # 项目全景
├── 02_directory_and_modules.md         # 目录结构与模块边界
├── 03_startup_and_runtime_flow.md      # 启动入口与运行链路
├── 04_core_business_flows.md           # 核心业务流程
├── 05_data_model_and_persistence.md    # 数据模型与持久化
├── 06_api_and_integrations.md          # API 与外部集成
├── 07_cross_cutting_concerns.md        # 鉴权、日志、异常、配置等
├── 08_tests_and_ci.md                  # 测试与 CI
├── 09_refactor_plan.md                 # 改造建议与风险清单
└── diagrams/                           # 架构图、时序图、依赖图
```

## 推荐解读顺序

1. 先读 `README`、依赖文件、启动脚本，确认项目如何运行。
2. 画出目录结构和模块职责，避免一开始陷入细节。
3. 找到启动入口和主要请求/任务链路。
4. 选择 2-3 条最核心业务流程做调用链解读。
5. 反向整理数据模型、接口契约和外部依赖。
6. 最后形成改造风险清单和分阶段改造计划。
