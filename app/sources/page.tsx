import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ServiceIcon } from "@/components/service-icon";
import manifest from "@/generated/manifest.json";
import { SourcesHeader } from "./sources-header";

export const metadata: Metadata = { title: "Data sources", description: "The Hong Kong open data services mcprouter serves as MCP tools." };

export default function SourcesPage() {
  return (
    <>
      <SourcesHeader />
      <ul className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {manifest.services.map((service, index) => (
          <li key={service.id}>
            <Link href={`/sources/${service.id}`} className="state-layer group flex h-full flex-col gap-4 rounded-lg bg-surface-container-low p-5 text-on-surface">
              <div className="flex items-start justify-between">
                <ServiceIcon id={service.id} index={index} />
                <ArrowRight size={20} className="text-on-surface-variant transition-transform group-hover:translate-x-0.5" />
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <h2 className="type-title-medium">{service.title}</h2>
                <p className="type-body-medium text-on-surface-variant">{service.description}</p>
              </div>
              <span className="type-label-medium text-on-surface-variant">
                {service.tools.length} {service.tools.length === 1 ? "tool" : "tools"} · {service.datasets.length} {service.datasets.length === 1 ? "dataset" : "datasets"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
