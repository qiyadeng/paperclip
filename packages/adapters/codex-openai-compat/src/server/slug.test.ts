import { describe, it, expect } from "vitest";
import { sanitizeSlug } from "./slug.js";

describe("sanitizeSlug", () => {
  it("lowercases and preserves alphanumerics", () => {
    expect(sanitizeSlug("DeepSeek")).toBe("deepseek");
    expect(sanitizeSlug("GPT4")).toBe("gpt4");
  });

  it("replaces spaces and symbols with underscore, collapses runs", () => {
    expect(sanitizeSlug("Qwen Plus")).toBe("qwen_plus");
    expect(sanitizeSlug("kimi-k2-instruct")).toBe("kimi_k2_instruct");
    expect(sanitizeSlug("hello!!world")).toBe("hello_world");
  });

  it("trims leading and trailing underscores", () => {
    expect(sanitizeSlug("__edge__")).toBe("edge");
    expect(sanitizeSlug("---abc---")).toBe("abc");
  });

  it("falls back to 'provider' for empty / non-ascii input", () => {
    expect(sanitizeSlug("")).toBe("provider");
    expect(sanitizeSlug("   ")).toBe("provider");
    expect(sanitizeSlug("通义千问")).toBe("provider");
    expect(sanitizeSlug("...")).toBe("provider");
  });

  it("treats nullish input as 'provider'", () => {
    expect(sanitizeSlug(undefined)).toBe("provider");
    expect(sanitizeSlug(null)).toBe("provider");
  });
});
