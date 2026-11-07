import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { IncomingMessage, RequestOptions } from "node:http";
import type { LookupFunction } from "node:net";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { externalFetch } from "@/lib/external-mcp/safe-fetch";

const network = vi.hoisted(() => ({ addresses: [{ address: "8.8.8.8", family: 4 }], status: 200, options: {} as RequestOptions, body: "", requests: 0 }));
vi.mock("node:dns/promises", () => ({ lookup: async () => network.addresses }));
vi.mock("node:https", () => ({ request: (_url: URL, options: RequestOptions, callback: (response: IncomingMessage) => void) => {
  network.requests++;
  network.options = options;
  const request = new EventEmitter();
  return Object.assign(request, { end: (body: Buffer | undefined) => {
    network.body = body?.toString() ?? "";
    const stream = new PassThrough();
    const response = Object.assign(stream, { statusCode: network.status, headers: { "content-type": "application/json" } }) as unknown as IncomingMessage;
    callback(response);
    stream.end('{"ok":true}');
  } });
} }));
beforeEach(() => { network.addresses = [{ address: "8.8.8.8", family: 4 }]; network.status = 200; network.requests = 0; });

describe("external MCP pinned transport", () => {
  it("pins the validated IP for both single and multi-address Node lookups", async () => {
    const response = await externalFetch("https://provider.test/mcp", { method: "POST", body: "fixture", headers: { authorization: "Bearer fixture", "accept-encoding": "gzip" } });
    expect(await response.json()).toEqual({ ok: true });
    expect(network.body).toBe("fixture");
    expect(network.options.headers).not.toHaveProperty("accept-encoding");
    const lookup = network.options.lookup as LookupFunction;
    const single = vi.fn();
    lookup("provider.test", {}, single);
    expect(single).toHaveBeenCalledWith(null, "8.8.8.8", 4);
    // A later DNS change cannot affect this request's socket.
    network.addresses = [{ address: "127.0.0.1", family: 4 }];
    const all = vi.fn();
    lookup("provider.test", { all: true }, all);
    expect(all).toHaveBeenCalledWith(null, [{ address: "8.8.8.8", family: 4 }]);
  });
  it("rejects a mixed private/public DNS response before making a request", async () => {
    network.addresses.push({ address: "10.0.0.1", family: 4 });
    await expect(externalFetch("https://provider.test/mcp")).rejects.toThrow("Private network");
    expect(network.requests).toBe(0);
  });
  it("refuses redirects rather than forwarding OAuth tokens", async () => {
    network.status = 302;
    await expect(externalFetch("https://provider.test/token", { method: "POST", body: "refresh_token=fixture" })).rejects.toThrow("redirects are not supported");
    expect(network.requests).toBe(1);
  });
});
