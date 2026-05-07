import { describe, it, expect } from "vitest";
import path from "node:path";
import os from "node:os";
import { resolveIsolatedCodexHomeDir } from "./codex-home.js";

describe("resolveIsolatedCodexHomeDir", () => {
  it("uses ~/.paperclip/instances/default by default", () => {
    const result = resolveIsolatedCodexHomeDir(
      { /* env */ },
      { companyId: "co_1", agentId: "ag_1" },
    );
    expect(result).toBe(
      path.join(
        os.homedir(),
        ".paperclip",
        "instances",
        "default",
        "companies",
        "co_1",
        "codex-openai-compat",
        "ag_1",
        "codex-home",
      ),
    );
  });

  it("honors PAPERCLIP_HOME override", () => {
    const result = resolveIsolatedCodexHomeDir(
      { PAPERCLIP_HOME: "/custom/root" },
      { companyId: "co_1", agentId: "ag_1" },
    );
    expect(result).toBe(
      "/custom/root/instances/default/companies/co_1/codex-openai-compat/ag_1/codex-home",
    );
  });

  it("honors PAPERCLIP_INSTANCE_ID override", () => {
    const result = resolveIsolatedCodexHomeDir(
      { PAPERCLIP_INSTANCE_ID: "dev" },
      { companyId: "co_1", agentId: "ag_1" },
    );
    expect(result).toBe(
      path.join(
        os.homedir(),
        ".paperclip",
        "instances",
        "dev",
        "companies",
        "co_1",
        "codex-openai-compat",
        "ag_1",
        "codex-home",
      ),
    );
  });

  it("combines both overrides", () => {
    const result = resolveIsolatedCodexHomeDir(
      { PAPERCLIP_HOME: "/x", PAPERCLIP_INSTANCE_ID: "y" },
      { companyId: "co_1", agentId: "ag_1" },
    );
    expect(result).toBe("/x/instances/y/companies/co_1/codex-openai-compat/ag_1/codex-home");
  });
});
