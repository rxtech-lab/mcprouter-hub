import { cosineSimilarity, embed, embedMany, toolSearch, type EmbeddingModel, type ToolSet, type UIMessage } from "ai";

/**
 * Tool search for the agent. MCP tools start deferred: the model first sees only
 * `search_tools`, searches for what it needs, and the matches are loaded on the
 * next step. Ranking is ours (see `searchTools`); loading is the AI SDK's.
 */

export const SEARCH_TOOL_NAME = "search_tools";

/** Matches loaded per search. A bus question needs routes, stops and arrivals in one go. */
export const MAX_SEARCH_RESULTS = 8;

export const DEFAULT_EMBEDDING_MODEL = "openai/text-embedding-3-small";

/** Below this cosine similarity a tool is unrelated to the query (text-embedding-3 scores unrelated text ~0.1–0.2). */
export const MIN_SIMILARITY = 0.3;

type Candidate = { name: string; description?: string };

/** Words people (and models) use for a service that its tool names and descriptions don't. */
const SYNONYMS: Record<string, string[]> = {
  bus: ["kmb", "citybus", "ctb"],
  buses: ["kmb", "citybus", "ctb"],
  巴士: ["bus", "kmb", "citybus"],
  eta: ["arrival", "next"],
  arrive: ["arrival", "eta"],
  train: ["mtr", "rail"],
  metro: ["mtr"],
  subway: ["mtr"],
  港鐵: ["mtr"],
  地鐵: ["mtr"],
  輕鐵: ["light", "rail"],
  weather: ["hko", "forecast"],
  天氣: ["weather", "hko", "forecast"],
  rain: ["weather", "forecast"],
  temperature: ["weather"],
  typhoon: ["warning", "signal", "weather"],
  颱風: ["typhoon", "warning"],
  storm: ["warning", "weather"],
  parking: ["carpark", "vacancy"],
  park: ["carpark"],
  停車場: ["carpark"],
  hospital: ["aed", "ha"],
  emergency: ["aed"],
  ae: ["aed"],
  急症: ["aed", "hospital"],
  holiday: ["holidays"],
  假期: ["holiday", "holidays"],
  dataset: ["datasets", "datagovhk"],
  data: ["datagovhk", "dataset"],
};

/** Too common to rank by; "hk" and "is" would otherwise match `hk_is_public_holiday` for every query. */
const STOPWORDS = new Set(["a", "an", "the", "is", "are", "in", "at", "of", "for", "to", "on", "and", "or", "me", "my", "i", "it", "what", "how", "get", "hk", "hong", "kong"]);

function stem(word: string) {
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

/** Lowercase word stems; splits snake_case, camelCase and `server__tool` names. */
export function tokenize(text: string): string[] {
  const words = text.replace(/([a-z\d])([A-Z])/g, "$1 $2").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  return words.map(stem);
}

function queryTerms(query: string) {
  const raw = query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const terms = new Set(tokenize(query).filter((term) => !STOPWORDS.has(term)));
  for (const word of raw) {
    // CJK has no spaces, so look synonyms up by substring too.
    for (const [key, expansions] of Object.entries(SYNONYMS)) {
      if (word === key || (/\p{Script=Han}/u.test(key) && word.includes(key))) for (const expansion of expansions) terms.add(stem(expansion));
    }
  }
  return [...terms];
}

function termScore(term: string, words: string[], exact: number) {
  if (words.includes(term)) return exact;
  // Partial matches ("vacan" → "vacancy"), only for terms long enough to mean something.
  if (term.length >= 4 && words.some((word) => word.startsWith(term) || (word.length >= 4 && term.startsWith(word)))) return exact / 2;
  return 0;
}

/** Keyword ranking for a search query: name matches count 3, description matches 1. */
export function rankTools(query: string, tools: readonly Candidate[]): string[] {
  const terms = queryTerms(query);
  return tools
    .map(({ name, description }, index) => {
      const nameWords = tokenize(name);
      const descriptionWords = tokenize(description ?? "");
      const score = terms.reduce((sum, term) => sum + termScore(term, nameWords, 3) + termScore(term, descriptionWords, 1), 0);
      return { name, score, index };
    })
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((match) => match.name);
}

/** What gets embedded for a tool: its name as words, then its description. */
export function toolDocument({ name, description }: Candidate) {
  return `${name.replace(/_+/g, " ")}: ${description ?? ""}`.trim();
}

/**
 * Tool embeddings, keyed by model and document. Tool descriptions rarely change,
 * so a warm instance embeds only the query. In-flight promises are shared so
 * concurrent chats don't embed the same tools twice.
 */
const embeddingCache = new Map<string, Promise<number[]>>();
const MAX_CACHED_EMBEDDINGS = 5000;

function cacheKey(model: EmbeddingModel, document: string) {
  return `${typeof model === "string" ? model : `${model.provider}/${model.modelId}`}\n${document}`;
}

async function embedTools(model: EmbeddingModel, tools: readonly Candidate[]): Promise<number[][]> {
  if (embeddingCache.size > MAX_CACHED_EMBEDDINGS) embeddingCache.clear();
  const documents = tools.map(toolDocument);
  const missing = [...new Set(documents.filter((document) => !embeddingCache.has(cacheKey(model, document))))];
  if (missing.length) {
    const batch = embedMany({ model, values: missing }).then((result) => result.embeddings);
    missing.forEach((document, index) => {
      const key = cacheKey(model, document);
      const entry = batch.then((embeddings) => embeddings[index]);
      // A failed batch must not poison the cache for the next search.
      entry.catch(() => embeddingCache.delete(key));
      embeddingCache.set(key, entry);
    });
  }
  return Promise.all(documents.map((document) => embeddingCache.get(cacheKey(model, document))!));
}

/** Semantic ranking: tools above `MIN_SIMILARITY`, most similar first. */
export async function rankToolsSemantically(query: string, tools: readonly Candidate[], model: EmbeddingModel): Promise<string[]> {
  const [{ embedding }, toolEmbeddings] = await Promise.all([embed({ model, value: query }), embedTools(model, tools)]);
  return tools
    .map(({ name }, index) => ({ name, similarity: cosineSimilarity(embedding, toolEmbeddings[index]) }))
    .filter((match) => match.similarity >= MIN_SIMILARITY)
    .sort((a, b) => b.similarity - a.similarity)
    .map((match) => match.name);
}

/** Merges ranked lists with reciprocal rank fusion, so neither ranking's score scale has to be calibrated. */
export function fuseRankings(...rankings: string[][]): string[] {
  const scores = new Map<string, number>();
  for (const ranking of rankings) ranking.forEach((name, rank) => scores.set(name, (scores.get(name) ?? 0) + 1 / (60 + rank)));
  return [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
}

/**
 * Hybrid search: meaning from embeddings, exact names ("KMB", "A&E") from keywords.
 * Falls back to keywords alone when the embedding model can't be reached.
 */
export async function searchTools(query: string, tools: readonly Candidate[], model: EmbeddingModel = DEFAULT_EMBEDDING_MODEL): Promise<string[]> {
  const keyword = rankTools(query, tools);
  try {
    return fuseRankings(await rankToolsSemantically(query, tools, model), keyword);
  } catch (error) {
    console.error("[agent] semantic tool search failed; using keyword search", error);
    return keyword;
  }
}

/** Tool names the conversation has already called; they stay loaded so follow-ups needn't search again. */
export function usedToolNames(messages: UIMessage[]): Set<string> {
  const names = new Set<string>();
  for (const message of messages) {
    for (const part of message.parts) {
      if (part.type === "dynamic-tool") names.add(part.toolName);
      else if (part.type.startsWith("tool-")) names.add(part.type.slice("tool-".length));
    }
  }
  return names;
}

/** Defers every tool except those already used, and adds the search tool. */
export function withToolSearch(tools: ToolSet, loaded: Set<string>, embeddingModel: EmbeddingModel = DEFAULT_EMBEDDING_MODEL): ToolSet {
  const deferred = Object.fromEntries(
    Object.entries(tools).map(([name, tool]) => [name, loaded.has(name) ? tool : { ...tool, deferLoading: true }]),
  ) as ToolSet;
  return {
    ...deferred,
    [SEARCH_TOOL_NAME]: toolSearch({ maxResults: MAX_SEARCH_RESULTS, search: ({ query, tools: candidates }) => searchTools(query, candidates, embeddingModel) }),
  };
}
