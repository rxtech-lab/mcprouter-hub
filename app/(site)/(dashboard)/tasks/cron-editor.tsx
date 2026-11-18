"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Settings2 } from "lucide-react";
import { NativeDialog } from "@/components/native-dialog";
import { Button } from "@/components/m3/button";
import { cronFields, explainCron } from "@/lib/tasks/cron";

const fieldClass = "mt-2 block w-full rounded-md border border-outline bg-surface-container-lowest p-3";
const definitions = [
  { name: "Minute", min: 0, max: 59 }, { name: "Hour", min: 0, max: 23 }, { name: "Day of month", min: 1, max: 31 }, { name: "Month", min: 1, max: 12 }, { name: "Day of week", min: 0, max: 7 },
];

export function CronPreview({ expression, timeZone }: { expression: string; timeZone: string }) {
  const [now] = useState(() => new Date());
  let preview: ReturnType<typeof explainCron> | undefined;
  let problem = "";
  try { preview = explainCron(expression, timeZone, now); }
  catch (error) { problem = error instanceof Error ? error.message : "Enter a valid cron expression and time zone."; }
  if (!preview) return <p role="status" className="mt-3 type-body-small text-error">{problem}</p>;
  return <div className="mt-3 rounded-lg bg-secondary-container/40 p-4" aria-live="polite"><p className="type-body-medium">{preview.description} ({timeZone}).</p><p className="mt-2 type-label-medium text-on-surface-variant">Next three scheduled times</p><ul className="mt-1 space-y-1 type-body-small">{preview.next.map(date => <li key={date}>{new Intl.DateTimeFormat("en", { timeZone, dateStyle: "medium", timeStyle: "short", hourCycle: "h23" }).format(new Date(date))}</li>)}</ul></div>;
}

export function CronEditor({ expression, timeZone, onChange }: { expression: string; timeZone: string; onChange: (expression: string) => void }) {
  const query = useSearchParams();
  const router = useRouter();
  const open = query.get("configure") === "cron";
  const navigate = (show: boolean) => { const next = new URLSearchParams(query); if (show) next.set("configure", "cron"); else next.delete("configure"); router.replace(`?${next}`, { scroll: false }); };
  return <><Button variant="tonal" icon={<Settings2 size={17} />} onClick={() => navigate(true)}>Configure visually</Button>{open && <CronDialog expression={expression} timeZone={timeZone} onClose={() => navigate(false)} onApply={value => { onChange(value); navigate(false); }} />}</>;
}

function CronDialog({ expression, timeZone, onClose, onApply }: { expression: string; timeZone: string; onClose: () => void; onApply: (value: string) => void }) {
  const [parts, setParts] = useState(() => { try { return cronFields(expression); } catch { return ["0", "9", "*", "*", "*"]; } });
  const [selected, setSelected] = useState(0);
  const [chosenMode, setChosenMode] = useState<string | null>(null);
  const definition = definitions[selected];
  const value = parts[selected];
  const inferredMode = value === "*" ? "every" : /^\*\/\d+$/.test(value) ? "step" : /^\d+-\d+$/.test(value) ? "range" : /^\d+(,\d+)*$/.test(value) ? "values" : "custom";
  const mode = chosenMode ?? inferredMode;
  const update = (value: string) => setParts(parts.map((part, index) => index === selected ? value : part));
  let valid = true;
  try { explainCron(parts.join(" "), timeZone, new Date()); } catch { valid = false; }
  return <NativeDialog title="Configure cron schedule" onClose={onClose}>
    <p className="mb-4 text-on-surface-variant">Configure each field, or use advanced syntax for any supported cron pattern. Times use {timeZone}.</p>
    <nav aria-label="Cron fields" className="mb-5 flex flex-wrap gap-2">{definitions.map((item, index) => <button key={item.name} type="button" aria-pressed={index === selected} onClick={() => { setSelected(index); setChosenMode(null); }} className="rounded-full px-3 py-2 type-label-medium transition-colors hover:bg-surface-container-highest aria-pressed:bg-secondary-container">{item.name}<span className="ml-2 font-mono">{parts[index]}</span></button>)}</nav>
    <div className="rounded-xl border border-outline-variant p-4"><label htmlFor="cron-mode" className="type-title-medium">{definition.name}</label><select id="cron-mode" className={fieldClass} value={mode} onChange={event => { setChosenMode(event.target.value); update(({ every: "*", step: "*/2", range: `${definition.min}-${Math.min(definition.min + 4, definition.max)}`, values: String(definition.min), custom: selected === 2 ? "L" : selected === 4 ? "1#1" : `${definition.min}-${definition.max}/2` })[event.target.value] ?? "*"); }}><option value="every">Every value</option><option value="values">Choose values</option><option value="step">Every N values</option><option value="range">Range</option><option value="custom">Advanced expression</option></select>
      {mode === "values" && <><label htmlFor="cron-values" className="mt-4 block type-label-large">Selected values</label><select id="cron-values" multiple value={value.split(",")} size={6} className={fieldClass} onChange={event => update(Array.from(event.target.selectedOptions, option => option.value).join(",") || String(definition.min))}>{Array.from({ length: definition.max - definition.min + 1 }, (_, i) => definition.min + i).map(number => <option key={number} value={number}>{selected === 4 ? `${number} · ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][number]}` : selected === 3 ? `${number} · ${new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, number - 1, 1)))}` : number}</option>)}</select><p className="mt-2 type-body-small">Hold Command or Control to select multiple values.</p></>}
      {mode === "step" && <><label htmlFor="cron-step" className="mt-4 block">Interval</label><input id="cron-step" className={fieldClass} type="number" min={1} max={definition.max} value={value.split("/")[1]} onChange={event => update(`*/${event.target.value}`)} /></>}
      {mode === "range" && <div className="mt-4 grid grid-cols-2 gap-3">{["From", "Through"].map((label, index) => <label key={label}>{label}<input className={fieldClass} type="number" min={definition.min} max={definition.max} value={value.split("-")[index]} onChange={event => { const range = value.split("-"); range[index] = event.target.value; update(range.join("-")); }} /></label>)}</div>}
      {mode === "custom" && <><label htmlFor="cron-custom" className="mt-4 block">Field expression</label><input id="cron-custom" className={`${fieldClass} font-mono`} value={value} onChange={event => update(event.target.value)} /><p className="mt-2 type-body-small text-on-surface-variant">Lists, ranges, steps, JAN–DEC, SUN–SAT, ? (any), L (last), # (nth weekday), and H (stable hashed value) where supported by the field.</p></>}
    </div>
    <p className="mt-4 font-mono text-primary">{parts.join(" ")}</p><CronPreview expression={parts.join(" ")} timeZone={timeZone} />
    <p className="mt-3 type-body-small text-on-surface-variant">The dispatcher checks once a minute. Missed occurrences are skipped. If both day fields are restricted, either day condition can match.</p>
    <div className="mt-6 flex justify-end gap-3"><Button variant="text" onClick={onClose}>Cancel</Button><Button disabled={!valid} onClick={() => onApply(parts.join(" "))}>Use schedule</Button></div>
  </NativeDialog>;
}
