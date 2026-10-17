/** Minimal CKAN client for DATA.GOV.HK. `package_search` only indexes ~785 datasets, so it is not used. */

const CKAN = { en: "https://data.gov.hk/en-data/api/3/action", tc: "https://data.gov.hk/tc-data/api/3/action" };

export type CkanPackage = {
  name: string;
  title: string;
  metadata_modified?: string;
  organization?: { name: string; title: string } | null;
  groups?: Array<{ name: string; title?: string }>;
  resources?: Array<{ format?: string; is_api?: string; url?: string }>;
};

async function call<T>(lang: "en" | "tc", action: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${CKAN[lang]}/${action}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000), cache: "no-store", headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`CKAN ${action} answered ${response.status}`);
  const body = (await response.json()) as { success: boolean; result: T; error?: { message?: string } };
  if (!body.success) throw new Error(`CKAN ${action} failed: ${body.error?.message ?? "unknown error"}`);
  return body.result;
}

export const listPackageIds = () => call<string[]>("en", "package_list");
export const showPackage = (id: string, lang: "en" | "tc" = "en") => call<CkanPackage>(lang, "package_show", { id });

/** Row values for the `datasets` table from a CKAN package. */
export function datasetFromPackage(pkg: CkanPackage, titleTc: string | null) {
  const resources = pkg.resources ?? [];
  const formats = [...new Set(resources.map((resource) => resource.format?.trim().toUpperCase()).filter((format): format is string => Boolean(format)))].sort();
  return {
    id: pkg.name,
    titleEn: pkg.title,
    titleTc,
    organization: pkg.organization?.name ?? null,
    organizationTitle: pkg.organization?.title ?? null,
    groups: (pkg.groups ?? []).map((group) => group.name).sort(),
    formats,
    isApi: resources.some((resource) => resource.is_api === "Y"),
    url: `https://data.gov.hk/en-data/dataset/${pkg.name}`,
    metadataModified: pkg.metadata_modified ?? null,
  };
}
