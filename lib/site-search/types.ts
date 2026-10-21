export type SearchDestination = { href: string; label: string; key: string; description?: string };
export type SearchResponse = { intent: "search" | "chat"; results: SearchDestination[]; fallback?: boolean };
