import manifest from "@/generated/manifest.json";
import { findApi } from "@/lib/apis";

/** Resolve the catalogue id on the server; never accept tool names or service scopes from the browser. */
export function apiChatScope(id: unknown) {
  if (typeof id !== "string") return null;
  const api = findApi(id);
  if (!api || api.status !== "implemented") return null;
  const services = manifest.services.filter((service) => api.services.includes(service.id));
  const tools = services.flatMap((service) => service.tools);
  if (!services.length || !tools.length) return null;
  return { api, title: api.title, services: services.map((service) => service.id), tools };
}

/** Service-page chats stay within that single service, including when its APIs share other services. */
export function serviceChatScope(id: unknown) {
  if (typeof id !== "string") return null;
  const service = manifest.services.find((service) => service.id === id);
  if (!service?.tools.length) return null;
  return { title: service.title, services: [service.id], tools: service.tools };
}
