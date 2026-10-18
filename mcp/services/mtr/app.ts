// MTR MCP App: next-train boards in line colours, Light Rail platforms and MTR Bus stops.
import { app, fmt, h, mount, setAccent, ui, type Content, type Row, type View } from "../../apps/runtime";
import { LINES, station } from "./stations";

function minutes(train: Row) {
  const value = Number(train.ttnt);
  if (!isFinite(value)) return fmt.time(train.time);
  return value <= 0 ? "Arriving" : `${value} min`;
}

function nextTrain(view: View) {
  const code = String(view.input.line ?? "").toUpperCase();
  const sta = String(view.input.sta ?? "").toUpperCase();
  const line = LINES[code] ?? { name: code, colour: "#5a6a75" };
  const body: Row = view.data ?? {};
  const board: Row = body.data?.[`${code}-${sta}`] ?? Object.values(body.data ?? {})[0] ?? null;
  app.every(30_000);
  setAccent(line.colour);

  const direction = (trains: Row[] | undefined) =>
    trains?.length
      ? ui.section(
          `To ${station(trains[0].dest)}`,
          ui.list(
            trains.map((train, index) =>
              ui.row({
                leading: h("span", { class: "chip" }, `Platform ${train.plat}`),
                title: station(train.dest),
                subtitle: `${fmt.time(train.time)}${train.route === "RAC" ? " · via Racecourse" : ""}`,
                trailing: h("span", { class: `eta${index === 0 ? " eta-next" : ""}` }, minutes(train)),
              }),
            ),
          ),
        )
      : null;

  return [
    ui.header({ badge: code, title: station(sta), subtitle: line.name, actions: [ui.refreshButton()] }),
    body.isdelay === "Y" ? ui.notice("Trains on this line are delayed.", "warning") : null,
    body.status === 0 ? ui.notice(body.message || "Train data is not available.", "warning") : null,
    board ? [direction(board.UP), direction(board.DOWN)] : ui.empty("No train times for this station right now."),
    ui.footer(view, body.curr_time ? `Updated ${fmt.time(body.curr_time)}` : null),
  ];
}

function lightRail(view: View) {
  const body: Row = view.data ?? {};
  const platforms: Row[] = body.platform_list ?? [];
  const chinese = app.lang !== "en";
  app.every(30_000);
  setAccent("#d3a809", "#1d1b16");
  return [
    ui.header({ badge: "LR", title: `Light Rail stop ${view.input.stationId}`, subtitle: `${platforms.length} platform${platforms.length === 1 ? "" : "s"}`, actions: [ui.refreshButton()] }),
    platforms.length
      ? platforms.map((platform) =>
          ui.section(
            `Platform ${platform.platform_id}`,
            ui.list(
              (platform.route_list ?? []).map((train: Row, index: number) =>
                ui.row({
                  leading: ui.badge(train.route_no),
                  title: chinese ? train.dest_ch : train.dest_en,
                  subtitle: train.train_length > 1 ? `${train.train_length} cars` : "1 car",
                  trailing: h("span", { class: `eta${index === 0 ? " eta-next" : ""}` }, chinese ? train.time_ch : train.time_en),
                }),
              ),
            ),
          ),
        )
      : ui.empty("No trains are due at this stop right now."),
    ui.footer(view, body.system_time ? `Updated ${fmt.time(body.system_time)}` : null),
  ];
}

function bus(view: View) {
  const body: Row = view.data ?? {};
  const stops: Row[] = body.busStop ?? [];
  const route = body.routeName ?? view.input.routeName;
  app.every(60_000);
  const colour = String(body.routeColour ?? "").replace(/[^0-9a-f]/gi, "").slice(0, 6);
  if (colour.length === 6) setAccent(`#${colour}`);
  return [
    ui.header({ badge: route, title: `MTR Bus ${route}`, subtitle: body.routeStatusRemarkTitle || null, actions: [ui.refreshButton()] }),
    body.routeStatusRemarkContent ? ui.notice(body.routeStatusRemarkContent, "warning") : null,
    stops.length
      ? ui.more(
          stops.map((stop) => {
            const buses: Row[] = (stop.bus ?? []).slice(0, 3);
            return ui.row({
              title: h("span", { class: "mono" }, stop.busStopId),
              subtitle: stop.isSuspended === "1" ? "Suspended" : stop.busStopRemark,
              trailing: buses.length
                ? h("span", { class: "etas" }, buses.map((item, index) => h("span", { class: `eta${index === 0 ? " eta-next" : ""}` }, item.departureTimeText || item.arrivalTimeText || "—")))
                : h("span", { class: "muted" }, "No buses"),
            });
          }),
          8,
          "stops",
        )
      : ui.empty("No stops reported for this route."),
  ];
}

const views: Record<string, (view: View) => Content> = { mtr_next_train: nextTrain, mtr_light_rail_schedule: lightRail, mtr_bus_schedule: bus };

mount({
  accent: "#ac2e44",
  render(view) {
    if (view.status === "loading") {
      const line = LINES[String(view.input.line ?? "").toUpperCase()];
      const title = view.input.sta ? station(String(view.input.sta).toUpperCase()) : view.input.routeName || "MTR";
      return [ui.header({ badge: view.input.line || "MTR", title, subtitle: line ? line.name : "Checking MTR…" }), ui.skeleton(3)];
    }
    const draw = view.tool ? views[view.tool] : undefined;
    return draw ? draw(view) : ui.generic(view.data);
  },
});
