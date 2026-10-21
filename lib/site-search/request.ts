import type { SearchResponse } from "./types";

/** Publish each response immediately, without waiting for the other request. */
export async function requestSiteSearch(query: string, locale: string, signal: AbortSignal, handlers: {
  results: (data: SearchResponse, source: "text" | "decision") => void;
  routingUnavailable: () => void;
  routingComplete: () => void;
  unavailable: () => void;
}) {
  const read = async (response: Response) => {
    if (!response.ok) throw new Error("Search unavailable");
    return response.json() as Promise<SearchResponse>;
  };
  let receivedResults = false;
  const publish = (data: SearchResponse, source: "text" | "decision") => {
    if (signal.aborted) return;
    receivedResults = true;
    handlers.results(data, source);
  };
  const text = fetch(`/api/search?q=${encodeURIComponent(query)}&locale=${encodeURIComponent(locale)}`, { signal })
    .then(read).then((data) => publish(data, "text"));
  const decision = query.trim() ? fetch("/api/search", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, locale }), signal,
  }).then(read).then((data) => {
    publish(data, "decision");
    if (data.fallback && !signal.aborted) handlers.routingUnavailable();
  }).catch(() => {
    if (!signal.aborted) handlers.routingUnavailable();
  }).finally(() => {
    if (!signal.aborted) handlers.routingComplete();
  }) : Promise.resolve();
  await Promise.allSettled([text, decision]);
  if (!receivedResults && !signal.aborted) handlers.unavailable();
}
