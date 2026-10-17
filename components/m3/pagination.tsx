import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { ButtonLink } from "./button";

/** Previous / next links for a server-paginated list whose page lives in the URL. */
export function Pagination({ page, pageCount, total, noun, href }: { page: number; pageCount: number; total: number; noun: string; href: (page: number) => string }) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
      <span className="type-body-small text-on-surface-variant">
        {formatNumber(total)} {noun} · page {page} of {pageCount}
      </span>
      <div className="flex gap-1">
        {page > 1 ? <ButtonLink href={href(page - 1)} variant="text" icon={<ChevronLeft size={16} />}>Previous</ButtonLink> : null}
        {page < pageCount ? <ButtonLink href={href(page + 1)} variant="text">Next <ChevronRight size={16} /></ButtonLink> : null}
      </div>
    </div>
  );
}
