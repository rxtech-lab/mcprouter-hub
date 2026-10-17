import { XMLParser } from "fast-xml-parser";
import Papa from "papaparse";

export type UpstreamFormat = "json" | "xml" | "csv" | "text";

export class UpstreamError extends Error {
  constructor(
    readonly code: "upstream_http" | "upstream_timeout" | "upstream_parse" | "upstream_network",
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", parseTagValue: true, trimValues: true });

/** Several government feeds (1823 holidays, some CSVs) start with a UTF-8 BOM. */
export function stripBom(text: string) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function parseBody(text: string, format: UpstreamFormat): unknown {
  const body = stripBom(text);
  try {
    switch (format) {
      case "json":
        return JSON.parse(body);
      case "xml":
        return xml.parse(body);
      case "csv": {
        const parsed = Papa.parse<Record<string, string>>(body.trim(), { header: true, skipEmptyLines: true });
        return parsed.data;
      }
      case "text":
        return body;
    }
  } catch (error) {
    throw new UpstreamError("upstream_parse", `Could not parse the upstream ${format} response: ${(error as Error).message}`);
  }
}

export async function fetchUpstream(input: {
  url: string;
  method?: "GET" | "POST";
  body?: unknown;
  headers?: Record<string, string>;
  format: UpstreamFormat;
  timeoutMs?: number;
}): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(input.url, {
      method: input.method ?? "GET",
      headers: {
        Accept: input.format === "json" ? "application/json" : "*/*",
        "User-Agent": "mcprouter/1.0 (+https://github.com/rxtech-lab)",
        ...(input.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...input.headers,
      },
      body: input.body === undefined ? undefined : JSON.stringify(input.body),
      signal: AbortSignal.timeout(input.timeoutMs ?? 15_000),
      cache: "no-store",
    });
  } catch (error) {
    const name = (error as Error).name;
    if (name === "TimeoutError" || name === "AbortError") {
      throw new UpstreamError("upstream_timeout", `The upstream API did not answer within ${input.timeoutMs ?? 15_000} ms`);
    }
    throw new UpstreamError("upstream_network", `Could not reach the upstream API: ${(error as Error).message}`);
  }
  const text = await response.text();
  if (!response.ok) {
    throw new UpstreamError("upstream_http", `The upstream API answered ${response.status}: ${text.slice(0, 200)}`, response.status);
  }
  return parseBody(text, input.format);
}
