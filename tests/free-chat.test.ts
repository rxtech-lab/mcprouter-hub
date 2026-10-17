import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { consumeFreeMessage, freeChatConfig, hkDay, nextHkMidnight, readFreeChatQuota, subjectsFor } from "@/lib/free-chat";

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "db/migrations" });
});

describe("freeChatConfig", () => {
  it("defaults to 15 a day, with four times that per address", () => {
    expect(freeChatConfig({})).toMatchObject({ enabled: true, dailyLimit: 15, ipDailyLimit: 60 });
  });

  it("reads the limits from the environment, and 0 turns the free chat off", () => {
    expect(freeChatConfig({ FREE_CHAT_DAILY_LIMIT: "5", FREE_CHAT_IP_DAILY_LIMIT: "8" })).toMatchObject({ enabled: true, dailyLimit: 5, ipDailyLimit: 8 });
    expect(freeChatConfig({ FREE_CHAT_DAILY_LIMIT: "0" }).enabled).toBe(false);
    expect(freeChatConfig({ FREE_CHAT_DAILY_LIMIT: "lots" }).dailyLimit).toBe(15);
  });
});

describe("Hong Kong days", () => {
  it("rolls over at midnight Hong Kong time", () => {
    expect(hkDay(new Date("2026-10-17T15:59:59Z"))).toBe("2026-10-17");
    expect(hkDay(new Date("2026-10-17T16:00:00Z"))).toBe("2026-10-18");
    expect(nextHkMidnight(new Date("2026-10-17T03:00:00Z")).toISOString()).toBe("2026-10-17T16:00:00.000Z");
  });
});

describe("free chat allowance", () => {
  const config = { ...freeChatConfig({ FREE_CHAT_DAILY_LIMIT: "3", FREE_CHAT_IP_DAILY_LIMIT: "4" }) };
  const now = new Date("2026-10-17T03:00:00Z");

  it("allows the daily limit per visitor, then refuses", async () => {
    const subjects = subjectsFor("visitor-a", "203.0.113.1") as { guest: string; ip: string };
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await consumeFreeMessage(subjects, config, now));
    expect(results.map((result) => result.allowed)).toEqual([true, true, true, false]);
    expect(results[2].quota).toMatchObject({ limit: 3, remaining: 0 });
    expect(await readFreeChatQuota(subjects, config, now)).toMatchObject({ remaining: 0, resetsAt: "2026-10-17T16:00:00.000Z" });
  });

  it("caps an address even when the visitor clears their cookie", async () => {
    const first = subjectsFor("visitor-b", "203.0.113.2") as { guest: string; ip: string };
    const second = subjectsFor("visitor-c", "203.0.113.2") as { guest: string; ip: string };
    for (let i = 0; i < 3; i++) await consumeFreeMessage(first, config, now);
    expect((await consumeFreeMessage(second, config, now)).allowed).toBe(true);
    expect((await consumeFreeMessage(second, config, now)).allowed).toBe(false);
  });

  it("starts again the next day", async () => {
    const subjects = subjectsFor("visitor-a", "203.0.113.1") as { guest: string; ip: string };
    expect((await consumeFreeMessage(subjects, config, new Date("2026-10-18T03:00:00Z"))).allowed).toBe(true);
  });

  it("doesn't store raw addresses", () => {
    expect(subjectsFor(null, "203.0.113.1")).toEqual({ guest: null, ip: expect.stringMatching(/^ip:[0-9a-f]{32}$/) });
  });
});
