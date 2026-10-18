import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { ButtonLink } from "./button";

/** Previous / next links for a server-paginated list whose page lives in the URL. */
export async function Pagination({ page, pageCount, total, noun, href }: { page: number; pageCount: number; total: number; noun: string; href: (page: number) => string }) {
  const t = await getT();
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
      <span className="type-body-small text-on-surface-variant">
        {t("{total} {noun} · page {page} of {pageCount}", { total: formatNumber(total, t.locale), noun, page, pageCount })}
      </span>
      <div className="flex gap-1">
        {page > 1 ? <ButtonLink href={href(page - 1)} variant="text" icon={<ChevronLeft size={16} />}>{t("Previous")}</ButtonLink> : null}
        {page < pageCount ? <ButtonLink href={href(page + 1)} variant="text">{t("Next")} <ChevronRight size={16} /></ButtonLink>
 : null}
      </div>
    </div>
  );
}
