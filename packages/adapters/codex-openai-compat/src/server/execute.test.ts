import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";

const { codexLocalExecuteMock } = vi.hoisted(() => ({
  codexLocalExecuteMock: vi.fn(),
}));

vi.mock("@paperclipai/adapter-codex-local/server", () => ({
  execute: codexLocalExecuteMock,
}));

import { execute } from "./execute.js";

function makeCtx(configOverrides: Record<string, unknown> = {}) {
  return {
    runId: "run_1",
    agent: { id: "ag_1", companyId: "co_1", name: "agent-1", adapterType: "codex_openai_compat", adapterConfig: null },
    runtime: { sessionId: null, sessionParams: null, sessionDisplayId: null, taskKey: null },
    config: {
      providerLabel: "DeepSeek",
      baseUrl: "https://api.deepseek.com/v1",
      apiKey: "sk-test-key",
      model: "deepseek-chat",
      wireApi: "chat",
      ...configOverrides,
    },
    context: {},
    onLog: async () => {},
  } as unknown as Parameters<typeof execute>[0];
}

describe("codex-openai-compat execute", () => {
  let homeRoot: string;

  beforeEach(async () => {
    homeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "pcoc-"));
    process.env.PAPERCLIP_HOME = homeRoot;
    process.env.PAPERCLIP_INSTANCE_ID = "test";
    codexLocalExecuteMock.mockReset();
    codexLocalExecuteMock.mockResolvedValue({
      exitCode: 0,
      signal: null,
      timedOut: false,
      provider: "openai",
      biller: "openai",
      billingType: "subscription",
      model: "deepseek-chat",
      usage: { inputTokens: 10, outputTokens: 20 },
      costUsd: null,
      sessionId: "sess_1",
      sessionParams: { sessionId: "sess_1" },
      sessionDisplayId: "sess_1",
      summary: "ok",
    });
  });

  afterEach(async () => {
    delete process.env.PAPERCLIP_HOME;
    delete process.env.PAPERCLIP_INSTANCE_ID;
    await fs.rm(homeRoot, { recursive: true, force: true });
  });

  it("writes config.toml to isolated CODEX_HOME before delegating", async () => {
    await execute(makeCtx());
    const expectedHome = path.join(
      homeRoot,
      "instances/test/companies/co_1/codex-openai-compat/ag_1/codex-home",
    );
    const tomlPath = path.join(expectedHome, "config.toml");
    const toml = await fs.readFile(tomlPath, "utf8");
    expect(toml).toContain("[model_providers.deepseek]");
    expect(toml).toContain('base_url = "https://api.deepseek.com/v1"');
    expect(toml).toContain('[profiles.deepseek]');
    expect(toml).toContain('model = "deepseek-chat"');
  });

  it("injects CODEX_HOME and OPENAI_API_KEY via config.env", async () => {
    await execute(makeCtx());
    const passedCtx = codexLocalExecuteMock.mock.calls[0][0];
    expect(passedCtx.config.env.CODEX_HOME).toMatch(/codex-openai-compat\/ag_1\/codex-home$/);
    expect(passedCtx.config.env.OPENAI_API_KEY).toBe("sk-test-key");
  });

  it("merges user-provided config.env after injected values (user overrides win)", async () => {
    await execute(makeCtx({ env: { OPENAI_API_KEY: "user-override", FOO: "bar" } }));
    const passedCtx = codexLocalExecuteMock.mock.calls[0][0];
    expect(passedCtx.config.env.OPENAI_API_KEY).toBe("user-override");
    expect(passedCtx.config.env.FOO).toBe("bar");
    // CODEX_HOME injection still present (user didn't override it)
    expect(passedCtx.config.env.CODEX_HOME).toMatch(/codex-home$/);
  });

  it("prepends --profile <slug> to extraArgs", async () => {
    await execute(makeCtx({ extraArgs: ["--foo"] }));
    const passedCtx = codexLocalExecuteMock.mock.calls[0][0];
    expect(passedCtx.config.extraArgs).toEqual(["--profile", "deepseek", "--foo"]);
  });

  it("strips OpenAI-only flags from delegated config (fastMode, search)", async () => {
    await execute(makeCtx({ fastMode: true, search: true }));
    const passedCtx = codexLocalExecuteMock.mock.calls[0][0];
    expect(passedCtx.config.fastMode).toBeUndefined();
    expect(passedCtx.config.search).toBeUndefined();
  });

  it("post-processes result: provider/biller/billingType overridden", async () => {
    const result = await execute(makeCtx());
    expect(result.provider).toBe("deepseek");
    expect(result.biller).toBe("deepseek");
    expect(result.billingType).toBe("api");
    // codex-local result usage and session passed through unchanged
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 20 });
    expect(result.sessionId).toBe("sess_1");
  });

  it("rejects empty providerLabel before spawn", async () => {
    await expect(execute(makeCtx({ providerLabel: "" }))).rejects.toThrow(
      /providerLabel/i,
    );
    expect(codexLocalExecuteMock).not.toHaveBeenCalled();
  });

  it("rejects empty apiKey before spawn", async () => {
    await expect(execute(makeCtx({ apiKey: "" }))).rejects.toThrow(/apiKey/i);
    expect(codexLocalExecuteMock).not.toHaveBeenCalled();
  });

  it("rejects empty baseUrl before spawn", async () => {
    await expect(execute(makeCtx({ baseUrl: "" }))).rejects.toThrow(/baseUrl/i);
    expect(codexLocalExecuteMock).not.toHaveBeenCalled();
  });

  it("rejects empty model before spawn", async () => {
    await expect(execute(makeCtx({ model: "" }))).rejects.toThrow(/model/i);
    expect(codexLocalExecuteMock).not.toHaveBeenCalled();
  });

  it("rejects non-object requestHeaders", async () => {
    await expect(
      execute(makeCtx({ requestHeaders: "not an object" })),
    ).rejects.toThrow(/requestHeaders/i);
  });
});
