import { describe, it, expect } from "vitest";
import { renderProviderToml } from "./config-toml.js";

describe("renderProviderToml", () => {
  it("renders the minimal required block", () => {
    const toml = renderProviderToml({
      slug: "deepseek",
      providerLabel: "DeepSeek",
      baseUrl: "https://api.deepseek.com/v1",
      model: "deepseek-chat",
      wireApi: "chat",
      requestHeaders: null,
    });
    expect(toml).toContain('[model_providers.deepseek]');
    expect(toml).toContain('name = "DeepSeek"');
    expect(toml).toContain('base_url = "https://api.deepseek.com/v1"');
    expect(toml).toContain('env_key = "OPENAI_API_KEY"');
    expect(toml).toContain('wire_api = "chat"');
    expect(toml).toContain('[profiles.deepseek]');
    expect(toml).toContain('model_provider = "deepseek"');
    expect(toml).toContain('model = "deepseek-chat"');
  });

  it("omits http_headers when requestHeaders is null", () => {
    const toml = renderProviderToml({
      slug: "x",
      providerLabel: "X",
      baseUrl: "https://x/v1",
      model: "x",
      wireApi: "chat",
      requestHeaders: null,
    });
    expect(toml).not.toContain("http_headers");
  });

  it("emits http_headers when requestHeaders is non-empty object", () => {
    const toml = renderProviderToml({
      slug: "qwen",
      providerLabel: "Qwen",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      model: "qwen-max",
      wireApi: "chat",
      requestHeaders: { "X-DashScope-Async": "enable" },
    });
    expect(toml).toContain('http_headers = { "X-DashScope-Async" = "enable" }');
  });

  it("escapes double quotes and backslashes in string values", () => {
    const toml = renderProviderToml({
      slug: "weird",
      providerLabel: 'Quote " and \\ backslash',
      baseUrl: "https://x/v1",
      model: "m",
      wireApi: "chat",
      requestHeaders: null,
    });
    expect(toml).toContain('name = "Quote \\" and \\\\ backslash"');
  });

  it("supports wireApi='responses'", () => {
    const toml = renderProviderToml({
      slug: "a",
      providerLabel: "A",
      baseUrl: "https://a/v1",
      model: "m",
      wireApi: "responses",
      requestHeaders: null,
    });
    expect(toml).toContain('wire_api = "responses"');
  });

  it("preserves the original providerLabel casing in name field even when slug differs", () => {
    const toml = renderProviderToml({
      slug: "qwen_plus",
      providerLabel: "Qwen Plus",
      baseUrl: "https://x/v1",
      model: "m",
      wireApi: "chat",
      requestHeaders: null,
    });
    expect(toml).toContain('[model_providers.qwen_plus]');
    expect(toml).toContain('name = "Qwen Plus"');
  });
});
