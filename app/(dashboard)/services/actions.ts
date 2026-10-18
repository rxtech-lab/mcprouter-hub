"use server";

import { z } from "zod";
import { services } from "@/generated/registry";
import { runAction } from "@/lib/action-result";
import { requireActionUser } from "@/lib/auth";
import { matchesService } from "@/lib/mcp/search";
import type { ServiceChoice } from "@/components/service-combobox";

const LIMIT = 20;

/** Services matching a query, for the service combobox. An empty query lists the first few. */
export async function searchServices(input: { query: string }) {
  return runAction(async (): Promise<{ items: ServiceChoice[]; total: number }> => {
    await requireActionUser();
    const query = z.string().max(100).parse(input.query).trim();
    const found = query ? services.filter((service) => matchesService(service, query)) : services;
    return {
      items: found.slice(0, LIMIT).map((service) => ({ id: service.id, title: service.title, region: service.region, tools: service.tools.length })),
      total: found.length,
    };
  });
}
