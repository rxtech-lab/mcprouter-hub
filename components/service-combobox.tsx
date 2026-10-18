"use client";

import { Check, LoaderCircle, Search, X } from "lucide-react";
import { Popover } from "radix-ui";
import { useEffect, useId, useRef, useState } from "react";
import { searchServices } from "@/app/(dashboard)/services/actions";
import { FilterChip } from "@/components/m3/chip";
import { cn } from "@/components/m3/cn";
import { useT } from "@/lib/i18n/client";
import { REGION_NAMES, type RegionId } from "@/lib/regions";
import type { ServiceSelection } from "@/lib/service-selection";

export type ServiceChoice = { id: string; title: string; region: string; tools: number };

const DEBOUNCE_MS = 250;

type ServiceComboboxProps = {
  legend: string;
  allLabel: string;
  value: ServiceSelection;
  onChange: (value: ServiceSelection) => void;
  disabled?: boolean;
};

/**
 * Picks services by searching the server as you type. The "All" chip allows
 * every service, including new ones; turning it off with nothing picked allows
 * none. Picked services show as chips.
 */
export function ServiceCombobox({ legend, allLabel, value, onChange, disabled }: ServiceComboboxProps) {
  const t = useT();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ items: ServiceChoice[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const latest = useRef(0);

  // Debounced search, ignoring answers to queries that have since changed.
  useEffect(() => {
    if (!open) return;
    const request = ++latest.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      const result = await searchServices({ query });
      if (request !== latest.current) return;
      setLoading(false);
      if (result.ok) {
        setResults(result.data);
        setError(null);
        setActive(0);
      } else {
        setError(result.error);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [open, query]);

  const picked = value === "all" ? [] : value;
  const selected = new Set(picked.map((service) => service.id));
  const items = results?.items ?? [];

  const toggle = (service: ServiceChoice) => {
    navigator.vibrate?.(10);
    onChange(selected.has(service.id) ? picked.filter((choice) => choice.id !== service.id) : [...picked, service]);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) return setOpen(true);
      if (items.length) setActive((index) => (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length);
    } else if (event.key === "Enter") {
      // Keep Enter from submitting the dialog's form.
      event.preventDefault();
      if (open && items[active]) toggle(items[active]);
    } else if (event.key === "Backspace" && !query && picked.length) {
      onChange(picked.slice(0, -1));
    }
  };

  const regionName = (id: string) => t(REGION_NAMES[id as RegionId] ?? id);
  const optionId = (index: number) => `${listId}-option-${index}`;

  return (
    <fieldset className="flex flex-col gap-3" disabled={disabled}>
      <legend className="pb-2 type-body-small text-on-surface-variant">{legend}</legend>

      <div className="flex flex-wrap gap-2" aria-live="polite">
        <FilterChip
          selected={value === "all"}
          onClick={() => {
            navigator.vibrate?.(10);
            onChange(value === "all" ? [] : "all");
          }}
        >
          {allLabel}
        </FilterChip>
        {picked.map((service) => (
          <span key={service.id} className="inline-flex h-8 animate-[fade-through_200ms_cubic-bezier(0.2,0,0,1)_both] items-center gap-1 rounded-sm bg-secondary-container pr-1 pl-3 type-label-large text-on-secondary-container">
            {service.title}
            <button
              type="button"
              aria-label={t("Remove {service}", { service: service.title })}
              title={t("Remove {service}", { service: service.title })}
              className="state-layer inline-flex size-6 cursor-pointer items-center justify-center rounded-full"
              onClick={() => toggle(service)}
            >
              <X size={16} />
            </button>
          </span>
        ))}
      </div>

      {value !== "all" && picked.length === 0 ? (
        <p className="type-body-small text-on-surface-variant" role="status">{t("No services, so no tools are available. Turn on All or pick some services.")}</p>
      ) : null}

      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Anchor asChild>
          <label className="flex h-14 items-center gap-3 rounded-xs border border-outline px-4 text-on-surface-variant transition-colors focus-within:border-2 focus-within:border-primary focus-within:px-[15px]">
            <Search size={20} className="shrink-0" />
            <input
              ref={inputRef}
              type="search"
              role="combobox"
              aria-label={t("Search services")}
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={open && items[active] ? optionId(active) : undefined}
              placeholder={t("Search services and tools")}
              value={query}
              autoComplete="off"
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onClick={() => setOpen(true)}
              onKeyDown={onKeyDown}
              className="min-w-0 flex-1 bg-transparent type-body-large text-on-surface outline-none placeholder:text-on-surface-variant/70"
            />
            {loading ? <LoaderCircle size={18} className="shrink-0 animate-spin" aria-label={t("Searching…")} /> : null}
          </label>
        </Popover.Anchor>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={4}
            // Focus stays in the input; options are reached with the arrow keys.
            onOpenAutoFocus={(event) => event.preventDefault()}
            onInteractOutside={(event) => {
              if (inputRef.current?.parentElement?.contains(event.target as Node)) event.preventDefault();
            }}
            className="z-50 max-h-72 w-(--radix-popover-trigger-width) animate-menu-in overflow-y-auto rounded-xs bg-surface-container py-2 shadow-elevation-2"
          >
            <ul id={listId} role="listbox" aria-multiselectable aria-label={legend} aria-busy={loading}>
              {items.map((service, index) => {
                const isSelected = selected.has(service.id);
                return (
                  <li
                    key={service.id}
                    id={optionId(index)}
                    role="option"
                    aria-selected={isSelected}
                    // Keep focus in the input while choosing.
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseMove={() => setActive(index)}
                    onClick={() => toggle(service)}
                    className={cn("flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2 text-on-surface", index === active && "bg-on-surface/8")}
                  >
                    <span className="flex size-5 shrink-0 items-center justify-center text-primary">{isSelected ? <Check size={18} /> : null}</span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate type-body-large">{service.title}</span>
                      <span className="truncate type-body-small text-on-surface-variant">
                        {regionName(service.region)} · {t.plural("{count} tool", "{count} tools", service.tools)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
            {error ? (
              <p className="px-4 py-3 type-body-medium text-error" role="alert">{error}</p>
            ) : results && !items.length ? (
              <p className="px-4 py-3 type-body-medium text-on-surface-variant" role="status">{t("No services match “{query}”", { query: query.trim() })}</p>
            ) : results && results.total > items.length ? (
              <p className="px-4 pt-2 type-body-small text-on-surface-variant" role="status">
                {t("Showing {shown} of {total}. Type to narrow it down.", { shown: items.length, total: results.total })}
              </p>
            ) : !results ? (
              <p className="px-4 py-3 type-body-medium text-on-surface-variant" role="status">{t("Searching…")}</p>
            ) : null}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </fieldset>
  );
}
