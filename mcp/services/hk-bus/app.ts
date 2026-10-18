// Buses & minibuses MCP App: KMB, Citybus and green minibus routes, stops and live arrival boards,
// each drawn in its operator's colours.
import { app, fmt, h, mount, setAccent, ui, type Content, type Row, type View } from "../../apps/runtime";

type Operator = { badge: string; name: string; accent: string; onAccent: string };

const OPERATORS = {
  kmb: { badge: "KMB", name: "KMB", accent: "#e1251b", onAccent: "#ffffff" },
  citybus: { badge: "CTB", name: "Citybus", accent: "#ffd200", onAccent: "#1d1b16" },
  gmb: { badge: "GMB", name: "Green minibus", accent: "#00843d", onAccent: "#ffffff" },
} satisfies Record<string, Operator>;

function operatorOf(tool: string | undefined): Operator {
  return OPERATORS[String(tool ?? "").split("_")[0] as keyof typeof OPERATORS] ?? OPERATORS.kmb;
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function directionName(code: unknown) {
  return code === "I" || code === "inbound" ? "inbound" : "outbound";
}

type Arrivals = { first: Row; etas: Array<{ eta: unknown; remark: string }> };

/** Groups KMB/Citybus arrival rows by route, direction and stop, in arrival order. */
function groupArrivals(rows: Row[]): Arrivals[] {
  const groups = new Map<string, Arrivals>();
  for (const row of rows) {
    const key = [row.route, row.dir, row.service_type, row.seq, row.dest_en].join("|");
    if (!groups.has(key)) groups.set(key, { first: row, etas: [] });
    groups.get(key)!.etas.push({ eta: row.eta, remark: fmt.pick(row, "rmk") });
  }
  return [...groups.values()];
}

function updated(rows: Row[]) {
  const stamp = rows[0]?.data_timestamp;
  return stamp ? `Updated ${fmt.time(stamp)}` : null;
}

// ------------------------------------------------------------ KMB and Citybus

function routes(view: View, operator: Operator) {
  const list: Row[] = view.data ?? [];
  const items = list.map((route) => {
    const direction = directionName(route.bound ?? route.dir);
    const special = route.service_type && route.service_type !== "1";
    return ui.row({
      leading: ui.badge(route.route),
      title: `${fmt.title(fmt.pick(route, "orig"))} → ${fmt.title(fmt.pick(route, "dest"))}`,
      subtitle: route.bound ? `${direction === "outbound" ? "Outbound" : "Inbound"}${special ? ` · special service ${route.service_type}` : ""}` : null,
      trailing: ui.icon("ask", 16),
      hint: "List the stops",
      onclick: () =>
        void app.sendMessage(`List the stops of ${operator.name} route ${route.route} ${direction}${special ? ` service type ${route.service_type}` : ""} with their names.`),
    });
  });
  return [
    ui.header({ badge: operator.badge, title: view.input.route ? `Route ${view.input.route}` : `${operator.name} routes`, subtitle: plural(list.length, "route") }),
    items.length ? ui.more(items, 8, "routes") : ui.empty("No routes match."),
    ui.footer(view),
  ];
}

function stopRow(stop: Row, operator: Operator) {
  return ui.row({
    leading: ui.icon("place", 20),
    title: fmt.title(fmt.pick(stop, "name")),
    subtitle: h("span", { class: "mono" }, stop.stop),
    trailing: [
      ui.mapButton(Number(stop.lat), Number(stop.long), ""),
      ui.askButton("Arrivals", `Next ${operator.name} arrivals at stop ${fmt.pick(stop, "name", "en")} (stop id ${stop.stop})`),
    ],
  });
}

function stops(view: View, operator: Operator) {
  const list: Row[] = view.data ?? [];
  return [
    ui.header({ badge: operator.badge, title: view.input.search ? `Stops matching “${view.input.search}”` : `${operator.name} stops`, subtitle: plural(list.length, "stop") }),
    list.length ? ui.more(list.map((stop) => stopRow(stop, operator)), 8, "stops") : ui.empty("No stops match."),
    ui.footer(view),
  ];
}

function stop(view: View, operator: Operator) {
  const data: Row = view.data ?? {};
  return [ui.header({ badge: operator.badge, title: fmt.title(fmt.pick(data, "name")) || "Stop", subtitle: data.stop }), ui.list([stopRow(data, operator)])];
}

function routeStops(view: View, operator: Operator) {
  const list: Row[] = view.data ?? [];
  const first: Row = list[0] ?? {};
  return [
    ui.header({ badge: first.route ?? view.input.route, title: `${operator.name} stops, ${directionName(first.bound ?? first.dir ?? view.input.direction)}`, subtitle: plural(list.length, "stop") }),
    ui.more(
      list.map((item) => {
        const name = fmt.title(fmt.pick(item, "name"));
        const route = item.route ?? view.input.route;
        return ui.row({
          leading: h("span", { class: "chip" }, String(item.seq)),
          title: name || h("span", { class: "mono" }, item.stop),
          subtitle: name ? h("span", { class: "mono" }, item.stop) : null,
          trailing: [
            item.lat && item.long ? ui.mapButton(Number(item.lat), Number(item.long), "") : null,
            ui.askButton("Arrivals", `Next ${operator.name} ${route} arrivals at ${name ? `${fmt.pick(item, "name", "en")} (stop id ${item.stop})` : `stop id ${item.stop}`}`),
          ],
        });
      }),
      10,
      "stops",
    ),
  ];
}

function stopEta(view: View, operator: Operator) {
  const rows: Row[] = view.data ?? [];
  const groups = groupArrivals(rows);
  app.every(30_000);
  return [
    ui.header({
      badge: operator === OPERATORS.citybus ? (view.input.route ?? operator.badge) : operator.badge,
      title: view.input.route ? `Route ${view.input.route} arrivals` : "Arrivals at this stop",
      subtitle: h("span", { class: "mono" }, view.input.stopId ?? ""),
      actions: [ui.refreshButton()],
    }),
    groups.length
      ? ui.list(
          groups.map((group) =>
            ui.row({
              leading: ui.badge(group.first.route),
              title: `To ${fmt.title(fmt.pick(group.first, "dest"))}`,
              subtitle: group.etas[0]?.remark || null,
              trailing: ui.etaChips(group.etas),
            }),
          ),
        )
      : ui.empty("No buses are due at this stop right now."),
    ui.footer(view, updated(rows)),
  ];
}

function routeEta(view: View, operator: Operator) {
  const groups = groupArrivals(view.data ?? []);
  app.every(30_000);
  const outbound = groups.filter((group) => group.first.dir !== "I");
  const inbound = groups.filter((group) => group.first.dir === "I");
  const direction = (list: Arrivals[]) =>
    list.length
      ? ui.section(
          `To ${fmt.title(fmt.pick(list[0].first, "dest"))}`,
          ui.more(list.map((group) => ui.row({ leading: h("span", { class: "chip" }, `Stop ${group.first.seq}`), title: "", trailing: ui.etaChips(group.etas) })), 8, "stops"),
        )
      : null;
  return [
    ui.header({ badge: view.input.route ?? operator.badge, title: `Arrivals along route ${view.input.route}`, actions: [ui.refreshButton()] }),
    direction(outbound),
    direction(inbound),
    groups.length ? null : ui.empty("No buses are running on this route right now."),
  ];
}

// ------------------------------------------------------------ green minibus

const REGIONS: Record<string, string> = { HKI: "Hong Kong Island", KLN: "Kowloon", NT: "New Territories" };

/** GMB ETAs carry an absolute `timestamp` (and minutes in `diff`). */
function gmbEtas(etas: Row[] | undefined) {
  return (etas ?? []).map((eta) => ({ eta: eta.timestamp, remark: fmt.pick(eta, "remarks") }));
}

function gmbRoutes(view: View, operator: Operator) {
  const codes: string[] = view.data ?? [];
  const region = REGIONS[view.input.region] ?? view.input.region;
  return [
    ui.header({ badge: operator.badge, title: `Minibus routes, ${region}`, subtitle: plural(codes.length, "route") }),
    codes.length
      ? h(
          "div",
          { class: "chips" },
          codes.map((code) =>
            h("button", { type: "button", class: "chip row-action", title: `Show route ${code}`, onclick: () => void app.sendMessage(`Show green minibus route ${code} in ${region}.`) }, String(code)),
          ),
        )
      : ui.empty("No routes in this region."),
  ];
}

function headway(direction: Row) {
  const first = direction.headways?.[0];
  if (!first?.frequency) return null;
  return `Every ${first.frequency}${first.frequency_upper ? `–${first.frequency_upper}` : ""} min from ${String(first.start_time).slice(0, 5)}`;
}

function gmbRoute(view: View, operator: Operator) {
  const variants: Row[] = view.data ?? [];
  return [
    ui.header({ badge: view.input.route ?? operator.badge, title: `Minibus ${view.input.route}`, subtitle: REGIONS[view.input.region] ?? view.input.region }),
    variants.length
      ? variants.map((variant) =>
          ui.section(
            fmt.pick(variant, "description") || `Route ${variant.route_code}`,
            ui.list(
              (variant.directions ?? []).map((direction: Row) =>
                ui.row({
                  title: `${fmt.pick(direction, "orig")} → ${fmt.pick(direction, "dest")}`,
                  subtitle: [headway(direction), fmt.pick(direction, "remarks")].filter(Boolean).join(" · ") || null,
                  trailing: ui.icon("ask", 16),
                  hint: "List the stops",
                  onclick: () => void app.sendMessage(`List the stops of green minibus route_id ${variant.route_id} route_seq ${direction.route_seq}.`),
                }),
              ),
            ),
          ),
        )
      : ui.empty("No minibus route with that number in this region."),
  ];
}

function gmbRouteStops(view: View, operator: Operator) {
  const list: Row[] = view.data ?? [];
  return [
    ui.header({ badge: operator.badge, title: "Minibus stops", subtitle: plural(list.length, "stop") }),
    ui.more(
      list.map((item) =>
        ui.row({
          leading: h("span", { class: "chip" }, String(item.stop_seq)),
          title: fmt.title(fmt.pick(item, "name")),
          trailing: ui.askButton("Arrivals", `Next minibus arrivals for route_id ${view.input.routeId} route_seq ${view.input.routeSeq ?? 1} stop_seq ${item.stop_seq}`),
        }),
      ),
      10,
      "stops",
    ),
  ];
}

function gmbStop(view: View, operator: Operator) {
  const data: Row = view.data ?? {};
  const point = data.coordinates?.wgs84;
  return [
    ui.header({ badge: operator.badge, title: `Minibus stop ${view.input.stopId}`, subtitle: fmt.pick(data, "remarks") || null }),
    h(
      "div",
      { class: "actions" },
      point ? ui.mapButton(point.latitude, point.longitude, "Open in Maps") : null,
      ui.askButton("Arrivals", `Next minibus arrivals at stop ${view.input.stopId}`),
    ),
  ];
}

function gmbStopRoutes(view: View, operator: Operator) {
  const list: Row[] = view.data ?? [];
  return [
    ui.header({ badge: operator.badge, title: fmt.title(fmt.pick(list[0], "name")) || `Minibus stop ${view.input.stopId}`, subtitle: `${plural(list.length, "route")} call here` }),
    ui.list(
      list.map((item) =>
        ui.row({
          leading: h("span", { class: "chip" }, `Route ${item.route_id}`),
          title: `Direction ${item.route_seq}, stop ${item.stop_seq}`,
          trailing: ui.askButton("Arrivals", `Next minibus arrivals for route_id ${item.route_id} route_seq ${item.route_seq} stop_seq ${item.stop_seq}`),
        }),
      ),
    ),
  ];
}

function gmbStopEta(view: View, operator: Operator) {
  const list: Row[] = (view.data ?? []).filter((item: Row) => item.enabled !== false);
  app.every(30_000);
  return [
    ui.header({ badge: operator.badge, title: "Minibus arrivals", subtitle: h("span", { class: "mono" }, `Stop ${view.input.stopId}`), actions: [ui.refreshButton()] }),
    list.length
      ? ui.list(
          list.map((item) =>
            ui.row({ leading: ui.badge(String(item.route_id)), title: `Direction ${item.route_seq}`, subtitle: `Stop ${item.stop_seq} on the route`, trailing: ui.etaChips(gmbEtas(item.eta)) }),
          ),
        )
      : ui.empty("No minibuses are due at this stop right now."),
    ui.footer(view, list.length ? "Ask for a route_id to see its route number." : null),
  ];
}

function gmbRouteStopEta(view: View, operator: Operator) {
  const data: Row = view.data ?? {};
  app.every(30_000);
  return [
    ui.header({ badge: operator.badge, title: "Minibus arrivals", subtitle: `Route ${view.input.routeId}, stop ${view.input.stopSeq}`, actions: [ui.refreshButton()] }),
    data.enabled === false
      ? ui.notice("Arrival times are not available for this stop.", "warning")
      : ui.list([ui.row({ title: "Next minibuses", trailing: ui.etaChips(gmbEtas(data.eta)) })]),
  ];
}

const views: Record<string, (view: View, operator: Operator) => Content> = {
  kmb_routes: routes,
  kmb_stops: stops,
  kmb_stop: stop,
  kmb_route_stops: routeStops,
  kmb_stop_eta: stopEta,
  kmb_route_eta: routeEta,
  citybus_routes: routes,
  citybus_stop: stop,
  citybus_route_stops: routeStops,
  citybus_eta: stopEta,
  gmb_routes: gmbRoutes,
  gmb_route: gmbRoute,
  gmb_route_stops: gmbRouteStops,
  gmb_stop: gmbStop,
  gmb_stop_routes: gmbStopRoutes,
  gmb_stop_eta: gmbStopEta,
  gmb_route_stop_eta: gmbRouteStopEta,
};

mount({
  accent: OPERATORS.kmb.accent,
  render(view) {
    const operator = operatorOf(view.tool);
    setAccent(operator.accent, operator.onAccent);
    if (view.status === "loading") {
      const label = view.input.route ? `Route ${view.input.route}` : view.input.search || view.input.stopId || operator.name;
      return [ui.header({ badge: operator.badge, title: label, subtitle: `Checking ${operator.name}…` }), ui.skeleton(3)];
    }
    const draw = view.tool ? views[view.tool] : undefined;
    return draw ? draw(view, operator) : ui.generic(view.data);
  },
});
