import { afterEach, beforeEach, expect, it, vi } from "vitest";

const { auth, headers, connection } = vi.hoisted(() => ({
  auth: vi.fn(), headers: vi.fn(), connection: vi.fn(),
}));
vi.mock("next/headers", () => ({ headers }));
vi.mock("next-auth", () => ({ default: vi.fn() }));
vi.mock("next/server", async (importOriginal) => ({
  ...await importOriginal<typeof import("next/server")>(), connection,
}));
vi.mock("@rxtech-lab/authjs-rxlab", () => ({
  createRxLabAuth: () => ({ auth, proxy: vi.fn(), handlers: {}, signIn: vi.fn(), signOut: vi.fn() }),
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  for (const name of ["AUTH_ISSUER", "AUTH_CLIENT_ID", "AUTH_CLIENT_SECRET", "AUTH_SECRET"]) vi.stubEnv(name, "test-only");
  vi.stubEnv("DEV_BYPASS_AUTH", "false");
  headers.mockResolvedValue(new Headers());
});
afterEach(() => vi.unstubAllEnvs());

it("does not initialize Auth.js for a cookie-free visitor with auth configured", async () => {
  const { getCurrentUser } = await import("@/lib/auth");
  expect(await getCurrentUser()).toBeNull();
  expect(connection).toHaveBeenCalled();
  expect(auth).not.toHaveBeenCalled();
});

it("still resolves signed-in users, including chunked session cookies", async () => {
  headers.mockResolvedValue(new Headers({ cookie: "__Secure-authjs.session-token.0=test-only" }));
  const user = { id: "user-1", name: "Member", email: "member@example.test", roles: ["user"] };
  auth.mockResolvedValue({ user });
  const { getCurrentUser } = await import("@/lib/auth");
  expect(await getCurrentUser()).toEqual(user);
  expect(auth).toHaveBeenCalledOnce();
});
