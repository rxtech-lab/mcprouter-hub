import { afterEach, expect, it, vi } from "vitest";
import { requestSiteSearch } from "@/lib/site-search/request";
const data = { intent: "search", results: [{ href: "/guides", key: "guides", label: "Guides" }] };
function deferred() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((done) => { resolve = done; });
  return { promise, resolve };
}
function setup() {
  const text = deferred(), decision = deferred();
  const fetcher = vi.fn().mockReturnValueOnce(text.promise).mockReturnValueOnce(decision.promise);
  vi.stubGlobal("fetch", fetcher);
  const handlers = { results: vi.fn(), routingUnavailable: vi.fn(), routingComplete: vi.fn(), unavailable: vi.fn() };
  const controller = new AbortController();
  const done = requestSiteSearch("guides", "en", controller.signal, handlers);
  return { text, decision, fetcher, handlers, controller, done };
}
afterEach(() => vi.unstubAllGlobals());
it("starts both requests immediately and publishes text before the decision resolves", async () => {
  const s = setup();
  expect(s.fetcher).toHaveBeenCalledTimes(2);
  expect(s.fetcher.mock.calls[0][1].signal).toBe(s.controller.signal);
  expect(s.fetcher.mock.calls[1][1].signal).toBe(s.controller.signal);
  s.text.resolve(Response.json(data));
  await vi.waitFor(() => expect(s.handlers.results).toHaveBeenCalledWith(data, "text"));
  expect(s.handlers.routingComplete).not.toHaveBeenCalled();
  s.decision.resolve(Response.json({ ...data, intent: "chat" }));
  await s.done;
  expect(s.handlers.results).toHaveBeenLastCalledWith({ ...data, intent: "chat" }, "decision");
});
it("publishes a decision without waiting for slower text search", async () => {
  const s = setup();
  s.decision.resolve(Response.json({ ...data, intent: "chat" }));
  await vi.waitFor(() => expect(s.handlers.routingComplete).toHaveBeenCalled());
  expect(s.handlers.results).toHaveBeenCalledWith({ ...data, intent: "chat" }, "decision");
  s.text.resolve(Response.json(data));
  await s.done;
  expect(s.handlers.unavailable).not.toHaveBeenCalled();
});
it("keeps text results when routing fails", async () => {
  const s = setup();
  s.text.resolve(Response.json(data));
  s.decision.resolve(new Response(null, { status: 503 }));
  await s.done;
  expect(s.handlers.results).toHaveBeenCalledExactlyOnceWith(data, "text");
  expect(s.handlers.routingUnavailable).toHaveBeenCalledOnce();
  expect(s.handlers.unavailable).not.toHaveBeenCalled();
});
it("uses decision results if text search fails and reports when both fail", async () => {
  const s = setup();
  s.text.resolve(new Response(null, { status: 500 }));
  s.decision.resolve(Response.json(data));
  await s.done;
  expect(s.handlers.results).toHaveBeenCalledExactlyOnceWith(data, "decision");
  const failed = setup();
  failed.text.resolve(new Response(null, { status: 500 }));
  failed.decision.resolve(new Response(null, { status: 500 }));
  await failed.done;
  expect(failed.handlers.unavailable).toHaveBeenCalledOnce();
});
it("ignores both responses after cancellation", async () => {
  const s = setup();
  s.controller.abort();
  s.text.resolve(Response.json(data));
  s.decision.resolve(Response.json({ ...data, fallback: true }));
  await s.done;
  for (const handler of Object.values(s.handlers)) expect(handler).not.toHaveBeenCalled();
});
it("only requests text for an empty query", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json(data));
  vi.stubGlobal("fetch", fetcher);
  await requestSiteSearch("", "en", new AbortController().signal, { results: vi.fn(), routingUnavailable: vi.fn(), routingComplete: vi.fn(), unavailable: vi.fn() });
  expect(fetcher).toHaveBeenCalledOnce();
});
