import { afterEach, describe, expect, it, vi } from "vitest";
import { API_KEY_PREFIX, checkKeyUsable, displayPrefix, generateApiKey, hashApiKey, keyAllowsService, matchesInternalKey, shouldTouchLastUsed } from "@/lib/api-keys";

describe("API keys", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("generates prefixed random keys and hashes them with sha256", () => {
    const key = generateApiKey();
    expect(key.startsWith(API_KEY_PREFIX)).toBe(true);
    expect(key).toHaveLength(API_KEY_PREFIX.length + 32);
    expect(generateApiKey()).not.toBe(key);
    expect(hashApiKey("mcpr_test")).toBe("5baa2e75050edb52ce23e761f233d91c8f9a48cc97fe55aee4b07ef026820187");
    expect(displayPrefix(key)).toBe(key.slice(0, 12));
  });

  it("rejects revoked and expired keys", () => {
    const now = new Date("2026-10-17T00:00:00Z");
    expect(checkKeyUsable({ revokedAt: null, expiresAt: null }, now)).toBeNull();
    expect(checkKeyUsable({ revokedAt: new Date(), expiresAt: null }, now)).toBe("revoked");
    expect(checkKeyUsable({ revokedAt: null, expiresAt: new Date("2026-10-16T00:00:00Z") }, now)).toBe("expired");
    expect(checkKeyUsable({ revokedAt: null, expiresAt: new Date("2026-10-18T00:00:00Z") }, now)).toBeNull();
  });

  it("scopes keys to services, empty meaning all", () => {
    expect(keyAllowsService([], "kmb")).toBe(true);
    expect(keyAllowsService(["kmb"], "kmb")).toBe(true);
    expect(keyAllowsService(["kmb"], "mtr")).toBe(false);
  });

  it("throttles lastUsedAt writes", () => {
    const now = new Date("2026-10-17T00:10:00Z");
    expect(shouldTouchLastUsed(null, now)).toBe(true);
    expect(shouldTouchLastUsed(new Date("2026-10-17T00:08:00Z"), now)).toBe(false);
    expect(shouldTouchLastUsed(new Date("2026-10-17T00:04:00Z"), now)).toBe(true);
  });

  it("matches the internal key only when it is set and long enough", () => {
    expect(matchesInternalKey("anything")).toBe(false);
    vi.stubEnv("MCPROUTER_INTERNAL_KEY", "short");
    expect(matchesInternalKey("short")).toBe(false);
    vi.stubEnv("MCPROUTER_INTERNAL_KEY", "a-long-enough-internal-key");
    expect(matchesInternalKey("a-long-enough-internal-key")).toBe(true);
    expect(matchesInternalKey("a-long-enough-internal-kez")).toBe(false);
    expect(matchesInternalKey("mcpr_x")).toBe(false);
  });
});
