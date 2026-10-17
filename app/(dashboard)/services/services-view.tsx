"use client";

import { ArrowLeft, Braces, ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/m3/button";
import { Card } from "@/components/m3/card";
import { Badge } from "@/components/m3/chip";
import { CodeBlock } from "@/components/m3/code-block";
import { CopyIconButton } from "@/components/m3/copy-button";
import { Dialog } from "@/components/m3/dialog";
import { ServiceIcon } from "@/components/service-icon";

export type ServiceCard = {
  id: string;
  title: string;
  description: string;
  datasets: string[];
  endpoint: string;
  tools: Array<{ name: string; title: string; description: string; schema: string }>;
};

type Tool = ServiceCard["tools"][number];

export function ServicesView({ services, allEndpoint, children }: { services: ServiceCard[]; allEndpoint: string; children: ReactNode }) {
  const [open, setOpen] = useState<ServiceCard | null>(null);
  // The schema replaces the service details inside the same dialog rather than stacking a second one.
  const [tool, setTool] = useState<Tool | null>(null);
  const close = () => {
    setOpen(null);
    setTool(null);
  };

  return (
    <>
      <Card variant="filled" className="mb-6 flex flex-wrap items-center gap-3">
        <span className="type-label-large text-on-surface-variant">All services</span>
        <code className="min-w-0 flex-1 truncate font-mono text-sm">{allEndpoint}</code>
        <CopyIconButton value={allEndpoint} label="Copy endpoint" what="Endpoint copied" />
      </Card>

      {children}

      {services.length ? (
        <ul className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="service-list">
          {services.map((service, index) => (
            <li key={service.id}>
              <button
                type="button"
                onClick={() => setOpen(service)}
                className="state-layer flex h-full w-full items-start gap-4 rounded-lg border border-outline-variant p-4 text-left text-on-surface"
              >
                <ServiceIcon id={service.id} index={index} />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="type-title-medium">{service.title}</span>
                  <span className="line-clamp-2 type-body-small text-on-surface-variant">{service.description}</span>
                  <span className="mt-1">
                    <Badge tone="primary">{service.tools.length} {service.tools.length === 1 ? "tool" : "tools"}</Badge>
                  </span>
                </span>
                <ChevronRight size={20} className="mt-3 shrink-0 text-on-surface-variant" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <Dialog
        open={open !== null}
        onOpenChange={(next) => !next && close()}
        title={tool ? tool.title : (open?.title ?? "")}
        description={tool ? `${open?.title} · ${tool.name}` : open?.description}
        className="w-[min(720px,calc(100vw-32px))]"
        actions={
          <>
            {tool ? <Button variant="text" icon={<ArrowLeft size={16} />} onClick={() => setTool(null)}>Back</Button> : null}
            <Button variant="text" onClick={close}>Close</Button>
          </>
        }
      >
        {open && tool ? (
          <div className="flex flex-col gap-3">
            <p className="type-body-medium">{tool.description}</p>
            <CodeBlock code={tool.schema} label="Input JSON Schema" what="Schema copied" />
          </div>
        ) : open ? (
          <div className="flex flex-col gap-4">
            <div>
              <span className="type-label-large text-on-surface-variant">Endpoint</span>
              <div className="mt-1 flex items-center gap-2 rounded-sm bg-surface-container px-3">
                <code className="min-w-0 flex-1 truncate py-2 font-mono text-[13px]">{open.endpoint}</code>
                <CopyIconButton value={open.endpoint} label={`Copy ${open.title} endpoint`} what="Endpoint copied" />
              </div>
            </div>
            <div>
              <span className="type-label-large text-on-surface-variant">Tools</span>
              <ul className="divide-y divide-outline-variant">
                {open.tools.map((item) => (
                  <li key={item.name} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <span className="font-mono text-sm text-primary">{item.name}</span>
                      <p className="type-body-medium text-on-surface-variant">{item.description}</p>
                    </div>
                    <Button variant="outlined" icon={<Braces size={16} />} onClick={() => setTool(item)}>
                      Input schema
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
            {open.datasets.length ? (
              <p className="type-body-small text-on-surface-variant">
                Datasets: {open.datasets.map((id) => (
                  <a key={id} className="mr-2 underline decoration-outline-variant hover:text-primary" href={`https://data.gov.hk/en-data/dataset/${id}`} target="_blank" rel="noreferrer">{id}</a>
                ))}
              </p>
            ) : null}
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
