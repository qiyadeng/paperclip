import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { ensureCommandResolvableMock } = vi.hoisted(() => ({
  ensureCommandResolvableMock: vi.fn<(cmd: string, cwd: string, env: NodeJS.ProcessEnv) => Promise<void>>(),
}));

vi.mock("@paperclipai/adapter-utils/server-utils", async () => {
  const actual = await vi.importActual<typeof import("@paperclipai/adapter-utils/server-utils")>(
    "@paperclipai/adapter-utils/server-utils",
  );
  return {
    ...actual,
    ensureCommandResolvable: ensureCommandResolvableMock,
  };
});

import { testEnvironment } from "./test.js";

function makeCtx(configOverrides: Record<string, unknown> = {}) {
  return {
    companyId: "co_1",
    adapterType: "codex_openai_compat",
    config: {
      providerLabel: "DeepSeek",
      baseUrl: "https://api.deepseek.com/v1",
      apiKey: "sk-test",
      model: "deepseek-chat",
      wireApi: "chat",
      ...configOverrides,
    },
  };
}

describe("codex-openai-compat testEnvironment", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    ensureCommandResolvableMock.mockReset();
    ensureCommandResolvableMock.mockResolvedValue();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.useRealTimers();
  });

  it("returns fail when codex binary is missing", async () => {
    ensureCommandResolvableMock.mockRejectedValueOnce(new Error("not found"));
    const result = await testEnvironment(makeCtx());
    expect(result.status).toBe("fail");
    expect(result.checks.some((c) => c.code === "codex_missing" && c.level === "error")).toBe(true);
  });

  it("returns fail when baseUrl is malformed", async () => {
    const result = await testEnvironment(makeCtx({ baseUrl: "ftp://nope" }));
    expect(result.status).toBe("fail");
    expect(result.checks.some((c) => c.code === "invalid_base_url")).toBe(true);
  });

  it("returns fail when apiKey is empty", async () => {
    const result = await testEnvironment(makeCtx({ apiKey: "" }));
    expect(result.status).toBe("fail");
    expect(result.checks.some((c) => c.code === "api_key_missing")).toBe(true);
  });

  it("returns fail when model is empty", async () => {
    const result = await testEnvironment(makeCtx({ model: "" }));
    expect(result.status).toBe("fail");
    expect(result.checks.some((c) => c.code === "model_missing")).toBe(true);
  });

  it("returns fail when requestHeaders is invalid JSON", async () => {
    const result = await testEnvironment(makeCtx({ requestHeaders: "{not valid" }));
    expect(result.status).toBe("fail");
    expect(result.checks.some((c) => c.code === "invalid_request_headers")).toBe(true);
  });

  it("returns pass when probe returns 200", async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 200, ok: true });
    const result = await testEnvironment(makeCtx());
    expect(result.status).toBe("pass");
  });

  it("warns when probe returns 401", async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 401, ok: false });
    const result = await testEnvironment(makeCtx());
    expect(result.status).toBe("warn");
    expect(result.checks.some((c) => c.code === "auth_failed")).toBe(true);
  });

  it("warns when probe returns 404", async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 404, ok: false });
    const result = await testEnvironment(makeCtx());
    expect(result.status).toBe("warn");
    expect(result.checks.some((c) => c.code === "models_endpoint_unsupported")).toBe(true);
  });

  it("warns on network error", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const result = await testEnvironment(makeCtx());
    expect(result.status).toBe("warn");
    expect(result.checks.some((c) => c.code === "endpoint_unreachable")).toBe(true);
  });
});
