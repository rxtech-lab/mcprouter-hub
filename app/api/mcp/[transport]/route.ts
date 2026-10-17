import { services } from "@/generated/registry";
import { createServiceRoute } from "@/lib/mcp/handler";

export const maxDuration = 60;

/** Every service on one endpoint: `/api/mcp/mcp`. */
const handler = createServiceRoute(() => services);

export { handler as GET, handler as POST, handler as DELETE };
