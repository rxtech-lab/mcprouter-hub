import { Search, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/** M3 search bar as a GET form, so the query lives in the URL and the server does the filtering. */
export function SearchBar({ action, query, placeholder, label, children }: { action: string; query?: string; placeholder: string; label: string; children?: ReactNode }) {
  return (
    <form action={action} role="search" className="flex flex-wrap items-center gap-3">
      <label className="flex h-14 min-w-0 flex-1 basis-72 items-center gap-3 rounded-full border-2 border-transparent bg-surface-container-high px-5 text-on-surface-variant transition-colors focus-within:border-primary">
        <Search size={20} className="shrink-0" />
        <input
          type="search"
          name="q"
          aria-label={label}
          placeholder={placeholder}
          defaultValue={query ?? ""}
          className="min-w-0 flex-1 bg-transparent type-body-large text-on-surface outline-none placeholder:text-on-surface-variant"
        />
        {query ? (
          <Link href={action} aria-label="Clear search" title="Clear search" className="state-layer -mr-2 inline-flex size-10 items-center justify-center rounded-full">
            <X size={18} />
          </Link>
        ) : null}
      </label>
      {children}
      <button type="submit" className="sr-only">Search</button>
    </form>
  );
}
