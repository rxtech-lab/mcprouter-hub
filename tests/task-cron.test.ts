import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/cron/tasks/route";
import { runDueTasks } from "@/lib/tasks/runner";
vi.mock("@/lib/tasks/runner", () => ({ runDueTasks: vi.fn(async () => []) }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("scheduled task cron authentication", () => {
  it("rejects missing, malformed and incorrect credentials before accessing tasks", async () => {
    vi.stubEnv("CRON_SECRET", "cron-test-secret");
    for (const authorization of ["", "cron-test-secret", "Bearer wrong", "Bearer cron-test-secret-extra"]) {
      expect((await GET(new Request("https://attacker.test/api/cron/tasks", { headers: { authorization } }))).status).toBe(401);
    }
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(new Request("https://app.test/api/cron/tasks"))).status).toBe(401);
    expect(runDueTasks).not.toHaveBeenCalled();
  });
  it("requires a configured canonical origin and never uses the request host for internal credentials", async () => {
    vi.stubEnv("CRON_SECRET", "cron-test-secret");
    vi.stubEnv("APP_URL", "");
    const request = () => new Request("https://attacker.test/api/cron/tasks", { headers: { authorization: "Bearer cron-test-secret" } });
    expect((await GET(request())).status).toBe(503);
    expect(runDueTasks).not.toHaveBeenCalled();
    vi.stubEnv("APP_URL", "https://app.test");
    expect((await GET(request())).status).toBe(200);
    expect(runDueTasks).toHaveBeenCalledWith("https://app.test");
  });
});
