import { authorizationServerMetadata, oauthOrigin } from "@/lib/mcp/oauth";
import { corsPreflight, noStoreJson } from "@/lib/mcp/oauth-http";

/** RFC 8414 metadata. Some clients append the MCP path, so any suffix gets the same document. */
export async function GET(request: Request) {
  return noStoreJson(authorizationServerMetadata(oauthOrigin(request)));
}

export const OPTIONS = corsPreflight;
