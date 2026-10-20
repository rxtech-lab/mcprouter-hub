import { app, fmt, h, ui, type Row, type View } from "../../apps/runtime";
import type { Operator } from "./operators";

export type ArrivalGroup = { first: Row; etas: Array<{ eta: unknown; remark: string }> };
const copy = () => app.lang === "en"
  ? { arrivals: "Bus arrivals", to: "To", next: "Next bus", later: "Then", details: "Timetable", close: "Close", none: "No upcoming departures", unknown: "Time unavailable", arriving: "Arriving", min: "min", scheduled: "Scheduled arrivals", stop: "Stop", refresh: "Refresh", refreshing: "Updating arrivals…", failed: "Could not update arrivals. Try again.", updated: "Updated", past: "Departed" }
  : { arrivals: "巴士到站時間", to: "往", next: "下一班", later: "之後", details: "班次詳情", close: "關閉", none: "暫無即將到站班次", unknown: "未有到站時間", arriving: "即將到站", min: "分鐘", scheduled: "預計到站", stop: "車站", refresh: "更新", refreshing: "正在更新到站時間…", failed: "未能更新到站時間，請再試。", updated: "更新於", past: "已開出" };

function countdown(value: unknown) {
  const c = copy();
  const minutes = fmt.minutesUntil(value);
  return minutes === null ? c.unknown : minutes < -1 ? c.past : minutes <= 0 ? c.arriving : `${minutes} ${c.min}`;
}

// Update countdowns in place so an open timetable and keyboard focus survive the clock tick.
let clockStarted = false;
function timeLabel(value: unknown, className: string) {
  return h("span", { class: className, "data-bus-eta": typeof value === "string" ? value : undefined }, countdown(value));
}

function timetable(group: ArrivalGroup, operator: Operator, opener: HTMLButtonElement) {
  const c = copy();
  const titleId = "bus-timetable-title";
  const dialog = h("dialog", { class: "bus-dialog", "aria-labelledby": titleId },
    h("header", { class: "bus-dialog-header" },
      h("div", null, h("p", { class: "bus-eyebrow" }, operator.name), h("h2", { id: titleId }, `${group.first.route ?? ""} · ${c.to} ${fmt.title(fmt.pick(group.first, "dest"))}`)),
      ui.button(c.close, () => dialog.close(), { variant: "text" })),
    h("p", { class: "bus-eyebrow" }, c.scheduled),
    h("ol", { class: "bus-timetable" }, group.etas.map((item) => h("li", null,
      h("div", null, h("time", { datetime: item.eta }, fmt.dateTime(item.eta) || c.unknown), item.remark ? h("p", { class: "muted" }, item.remark) : null),
      timeLabel(item.eta, "bus-time-small")))));
  dialog.addEventListener("click", (event) => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
  dialog.addEventListener("close", () => { dialog.remove(); opener.focus(); });
  document.body.append(dialog);
  dialog.showModal();
}

export function arrivalBoard(view: View, operator: Operator, groups: ArrivalGroup[]) {
  const c = copy();
  if (!clockStarted) {
    clockStarted = true;
    setInterval(() => document.querySelectorAll<HTMLElement>("[data-bus-eta]").forEach((element) => { element.textContent = countdown(element.dataset.busEta); }), 30_000);
  }
  const refresh = app.canCallTools ? ui.button(c.refresh, async () => {
    refresh!.disabled = true;
    const overlay = h("div", { class: "bus-status", role: "status" }, c.refreshing);
    document.body.append(overlay);
    try { await app.refresh(); } catch { overlay.textContent = c.failed; }
    finally { refresh!.disabled = false; setTimeout(() => overlay.remove(), overlay.textContent === c.failed ? 5000 : 0); }
  }, { icon: "refresh", variant: "text" }) : null;
  const stamp = view.data?.[0]?.data_timestamp;
  return h("section", { class: "bus-board", "aria-label": c.arrivals },
    h("header", { class: "bus-board-header" },
      h("div", null, h("p", { class: "bus-eyebrow" }, operator.name), h("h1", null, c.arrivals),
        view.input.stopId ? h("p", { class: "bus-stop-label" }, ui.icon("place", 14), `${c.stop} ${view.input.stopId}`) : null), refresh),
    groups.length ? h("div", { class: "bus-arrival-list" }, groups.map((group) => {
      const upcoming = group.etas.filter((item) => { const minutes = fmt.minutesUntil(item.eta); return minutes !== null && minutes >= -1; }).sort((a, b) => fmt.date(a.eta)!.getTime() - fmt.date(b.eta)!.getTime());
      const next = upcoming[0];
      const details = ui.button(c.details, () => timetable(group, operator, details), { variant: "text", icon: "open" });
      const destination = fmt.title(fmt.pick(group.first, "dest"));
      const alternate = app.lang === "en" ? group.first.dest_tc : group.first.dest_en;
      return h("article", { class: "bus-arrival-card" },
        h("div", { class: "bus-route-heading" }, ui.badge(String(group.first.route ?? view.input.route ?? operator.badge)),
          h("div", { class: "bus-destination" }, h("p", { class: "bus-eyebrow" }, c.to), h("h2", null, destination), alternate && alternate !== destination ? h("p", { class: "bus-alternate" }, fmt.title(alternate)) : null)),
        h("div", { class: "bus-next" }, h("div", null, h("p", { class: "bus-eyebrow" }, c.next), next ? timeLabel(next.eta, "bus-countdown") : h("p", { class: "bus-no-arrivals" }, c.none)),
          next ? h("time", { class: "bus-clock", datetime: next.eta }, fmt.time(next.eta)) : null),
        next?.remark ? h("p", { class: "bus-remark" }, next.remark) : null,
        h("footer", { class: "bus-card-footer" }, h("p", { class: "bus-later" }, upcoming.length > 1 ? [h("span", { class: "bus-eyebrow" }, c.later), ...upcoming.slice(1, 3).map((item) => h("time", { datetime: item.eta }, fmt.time(item.eta)))] : null), details));
    })) : ui.empty(c.none),
    stamp ? h("footer", { class: "footer" }, `${c.updated} ${fmt.time(stamp)}`) : null);
}
