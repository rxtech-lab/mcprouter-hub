import { serviceById } from "@/generated/registry";
import { createServiceRoute } from "@/lib/mcp/handler";

export const maxDuration = 60;

/** One service per endpoint, for a smaller tool list: `/api/mcp/s/<service>/streamable`. */
const handler = createServiceRoute((request) => {
  const segments = new URL(request.url).pathname.split("/");
  const service = serviceById.get(decodeURIComponent(segments[segments.indexOf("s") + 1] ?? ""));
  return service ? [service] : null;
});

export { handler as GET, handler as POST, handler as DELETE };
