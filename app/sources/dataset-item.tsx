import { ExternalLink, Wrench } from "lucide-react";
import Link from "@/components/localized-link";
import { Badge } from "@/components/m3/chip";
import manifest from "@/generated/manifest.json";
import { datasetUrl } from "@/lib/sources";

type Dataset = {
  id: string;
  titleEn: string;
  titleTc: string | null;
  organization: string | null;
  organizationTitle: string | null;
  formats: string[];
  isApi: boolean;
  url: string | null;
};

/** One catalogue dataset: title, formats, the mcprouter services built on it, and a link to DATA.GOV.HK. */
export function DatasetItem({ dataset, services = [], showProvider = false }: { dataset: Dataset; services?: string[]; showProvider?: boolean }) {
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-outline-variant p-4 sm:flex-row sm:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="type-title-medium">{dataset.titleEn.replace(/\s+/g, " ")}</h3>
        {dataset.titleTc ? <p lang="zh-HK" className="type-body-medium text-on-surface-variant">{dataset.titleTc}</p> : null}
        {showProvider && dataset.organization ? (
          <Link href={`/sources/providers/${encodeURIComponent(dataset.organization)}`} className="self-start type-body-small text-primary hover:underline">
            {dataset.organizationTitle ?? dataset.organization}
          </Link>
        ) : null}
        <div className="mt-1 flex flex-wrap gap-1.5">
          {services.map((id) => {
            const service = manifest.services.find((item) => item.id === id);
            return (
              <Link key={id} href={`/sources/${id}`}>
                <Badge tone="primary" icon={<Wrench size={12} />}>{service?.title ?? id}</Badge>
              </Link>
            );
          })}
          {dataset.isApi ? <Badge tone="tertiary">API</Badge> : null}
          {dataset.formats.filter((format) => format !== "API").map((format) => <Badge key={format}>{format}</Badge>)}
        </div>
      </div>
      <a
        href={datasetUrl(dataset)}
        target="_blank"
        rel="noreferrer"
        className="state-layer inline-flex h-10 shrink-0 items-center gap-2 self-start rounded-full px-3 type-label-large text-primary"
      >
        DATA.GOV.HK <ExternalLink size={16} />
      </a>
    </li>
  );
}
