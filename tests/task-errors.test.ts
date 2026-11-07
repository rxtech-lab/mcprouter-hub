import { afterEach, describe, expect, it, vi } from "vitest";
import { safeErrorDetail, taskFailure } from "@/lib/tasks/errors";
import { UsageLimitError } from "@/lib/billing/errors";

afterEach(() => vi.unstubAllEnvs());

describe("task failure details", () => {
  it("retains the failure stage, status and underlying network cause", () => {
    const cause = Object.assign(new Error("Connection refused"), { code: "ECONNREFUSED" });
    const error = Object.assign(new Error("MCP connection failed", { cause }), { statusCode: 503 });
    expect(taskFailure("Running MCP workflow", error)).toBe("Running MCP workflow\nMCP connection failed (HTTP 503)\nCaused by: Connection refused [ECONNREFUSED]");
  });

  it("redacts provider credentials and never serializes request bodies or headers", () => {
    vi.stubEnv("PROVIDER_SECRET", "my-opaque-credential");
    const error = Object.assign(new Error('Unauthorized: Bearer abc-secret; client_secret="oauth-secret"; refresh_token=refresh-secret; apiKey=key-secret; my-opaque-credential; https://user:password@example.com/mcp?token=url-secret'), {
      requestBodyValues: { password: "request-body-secret" }, responseBody: "response-body-secret", headers: { Authorization: "header-secret" },
    });
    const detail = safeErrorDetail(error);
    expect(detail).toContain("Unauthorized");
    for (const secret of ["abc-secret", "oauth-secret", "refresh-secret", "key-secret", "my-opaque-credential", "user:password", "url-secret", "request-body-secret", "response-body-secret", "header-secret"]) expect(detail).not.toContain(secret);
  });

  it("includes failures for each unavailable MCP connection and tolerates circular causes", () => {
    const error = new Error("OAuth refresh rejected");
    error.cause = error;
    expect(safeErrorDetail(new AggregateError([error, new Error("MCP server returned 502")], "Connections unavailable"))).toContain("MCP server returned 502");
    expect(safeErrorDetail(error)).toBe("OAuth refresh rejected");
  });

  it("explains exhausted allowance and insufficient credits separately", () => {
    expect(taskFailure("Checking chat allowance", new UsageLimitError("chat", "limit_exceeded", 10, 10))).toContain("Chat allowance exhausted");
    expect(taskFailure("Checking chat allowance", new UsageLimitError("chat", "insufficient_balance", 10, 10))).toContain("Insufficient credits");
  });
});
