import "server-only";
import { lookup, Resolver } from "node:dns/promises";
import { isIP } from "node:net";
import { request as httpsRequest } from "node:https";
import { Readable } from "node:stream";

/** Public HTTPS endpoints only, including every discovered OAuth endpoint. */
export function publicAddress(address: string) {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19)));
  }
  // Accept only global unicast IPv6. This excludes mapped IPv4, loopback and link-local.
  return isIP(address) === 6 && /^[23][0-9a-f]{3}:/i.test(address) && !address.toLowerCase().startsWith("2001:db8:");
}

function syntheticAddress(address: string) {
  return /^198\.(18|19)\./.test(address);
}

async function publicTarget(value: string | URL) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.hash || (url.port && url.port !== "443")) throw new Error("Use a public HTTPS MCP URL");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  let addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  // Local VPNs can replace public DNS answers with benchmarking-range fake IPs.
  // Resolve those names independently; never connect to the synthetic address.
  if (process.env.NODE_ENV === "development" && !isIP(host) && addresses.length && addresses.every(({ address }) => syntheticAddress(address))) {
    const resolver = new Resolver({ timeout: 3000, tries: 1 });
    resolver.setServers(["1.1.1.1", "8.8.8.8"]);
    const results = await Promise.allSettled([resolver.resolve4(host), resolver.resolve6(host)]);
    addresses = results.flatMap((result) => result.status === "fulfilled" ? result.value.map((address) => ({ address })) : []);
  }
  if (!addresses.length || addresses.some(({ address }) => !publicAddress(address))) throw new Error("Private network endpoints are not supported");
  return { url, address: addresses[0].address };
}

export async function assertPublicUrl(value: string | URL) {
  return (await publicTarget(value)).url;
}

/** Pin the validated DNS address for the actual socket, preventing DNS rebinding.
 * TLS still verifies the original hostname. Redirects are never followed.
 */
export const externalFetch: typeof fetch = async (input, init) => {
  const outgoing = new Request(input, init);
  const { url, address } = await publicTarget(outgoing.url);
  const signal = AbortSignal.any([outgoing.signal, AbortSignal.timeout(30_000)]);
  const headers = Object.fromEntries(outgoing.headers.entries());
  // Node's HTTPS stream is uncompressed; do not request a compressed response.
  delete headers["accept-encoding"];
  const body = outgoing.body ? Buffer.from(await outgoing.arrayBuffer()) : undefined;
  return new Promise<Response>((resolve, reject) => {
    const request = httpsRequest(url, {
      method: outgoing.method, headers, signal,
      lookup: (_hostname, options, callback) => {
        if (options.all) callback(null, [{ address, family: isIP(address) }]);
        else callback(null, address, isIP(address));
      },
    }, (response) => {
      const status = response.statusCode ?? 502;
      if (status >= 300 && status < 400) {
        response.destroy();
        reject(new Error("MCP and OAuth redirects are not supported"));
        return;
      }
      const responseHeaders = new Headers();
      for (const [name, value] of Object.entries(response.headers)) {
        if (value !== undefined) responseHeaders.set(name, Array.isArray(value) ? value.join(", ") : value);
      }
      const empty = outgoing.method === "HEAD" || status === 204 || status === 205 || status === 304;
      if (empty) response.resume();
      resolve(new Response(empty ? null : Readable.toWeb(response) as ReadableStream<Uint8Array>, { status, headers: responseHeaders }));
    });
    request.on("error", () => reject(new Error("External MCP request failed")));
    request.end(body);
  });
};
