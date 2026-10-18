// Bus, minibus and tram chat cards: routes, stops and arrival boards in each operator's colours, as still pictures.
import { blocks, card, fmt, langOf, truncation, type Card, type CardBuilder, type CardInput, type Lang, type Row } from "../../apps/card";
import { OPERATORS, operatorOf, type Operator } from "./operators";

const brand = (operator: Operator, badge = operator.badge) => ({ accent: operator.accent, onAccent: operator.onAccent, badge: String(badge) });

const directionName = (code: unknown) => (code === "I" || code === "inbound" ? "inbound" : "outbound");

type Arrivals = { first: Row; etas: string[]; remark: string };

/** Groups KMB/Citybus arrival rows by route, direction and stop, in arrival order. */
function groupArrivals(rows: Row[], lang: Lang): Arrivals[] {
  const groups = new Map<string, Arrivals>();
  for (const row of rows) {
    const key = [row.route, row.dir, row.service_type, row.seq, row.dest_en].join("|");
    if (!groups.has(key)) groups.set(key, { first: row, etas: [], remark: fmt.pick(row, "rmk", lang) });
    groups.get(key)!.etas.push(fmt.eta(row.eta));
  }
  return [...groups.values()];
}

const etaChips = (group: Arrivals) => (group.etas.some(Boolean) ? card.etas(group.etas) : [{ text: group.remark || "No departures" }]);

function routes(result: CardInput, operator: Operator): Card {
  const list: Row[] = result.data ?? [];
  const lang = langOf(result.input);
  return {
    ...brand(operator),
    title: result.input?.route ? `Route ${result.input.route}` : `${operator.name} routes`,
    subtitle: fmt.plural(list.length, "route"),
    blocks: list.length
      ? list.map((route) =>
          card.row({
            leading: { text: String(route.route), tone: "accent" },
            title: `${fmt.title(fmt.pick(route, "orig", lang))} → ${fmt.title(fmt.pick(route, "dest", lang))}`,
            subtitle: route.bound ? `${directionName(route.bound) === "outbound" ? "Outbound" : "Inbound"}${route.service_type && route.service_type !== "1" ? ` · special service ${route.service_type}` : ""}` : null,
          }),
        )
      : [card.text("No routes match.", true)],
    footer: truncation(result),
  };
}

function stops(result: CardInput, operator: Operator): Card {
  const list: Row[] = result.data ?? [];
  const lang = langOf(result.input);
  return {
    ...brand(operator),
    title: result.input?.search ? `Stops matching “${result.input.search}”` : `${operator.name} stops`,
    subtitle: fmt.plural(list.length, "stop"),
    blocks: list.length ? list.map((stop) => card.row({ title: fmt.title(fmt.pick(stop, "name", lang)), subtitle: stop.stop })) : [card.text("No stops match.", true)],
    footer: truncation(result),
  };
}

function routeStops(result: CardInput, operator: Operator): Card {
  const list: Row[] = result.data ?? [];
  const first: Row = list[0] ?? {};
  const lang = langOf(result.input);
  return {
    ...brand(operator, first.route ?? result.input?.route ?? operator.badge),
    title: `${operator.name} stops, ${directionName(first.bound ?? first.dir ?? result.input?.direction)}`,
    subtitle: fmt.plural(list.length, "stop"),
    blocks: list.map((item) => {
      const name = fmt.title(fmt.pick(item, "name", lang));
      return card.row({ leading: { text: String(item.seq) }, title: name || String(item.stop), subtitle: name ? item.stop : null });
    }),
  };
}

function stopEta(result: CardInput, operator: Operator): Card {
  const rows: Row[] = result.data ?? [];
  const lang = langOf(result.input);
  const groups = groupArrivals(rows, lang);
  return {
    ...brand(operator, operator === OPERATORS.citybus ? (result.input?.route ?? operator.badge) : operator.badge),
    title: result.input?.route ? `Route ${result.input.route} arrivals` : "Arrivals at this stop",
    subtitle: result.input?.stopId ?? null,
    blocks: groups.length
      ? groups.map((group) =>
          card.row({
            leading: { text: String(group.first.route), tone: "accent" },
            title: `To ${fmt.title(fmt.pick(group.first, "dest", lang))}`,
            subtitle: group.etas.some(Boolean) ? group.remark || null : null,
            trailing: etaChips(group),
          }),
        )
      : [card.text("No buses are due at this stop right now.", true)],
    footer: rows[0]?.data_timestamp ? `Updated ${fmt.time(rows[0].data_timestamp)}` : null,
  };
}

function routeEta(result: CardInput, operator: Operator): Card {
  const lang = langOf(result.input);
  const groups = groupArrivals(result.data ?? [], lang);
  const direction = (list: Arrivals[]) =>
    list.length
      ? [
          card.section(`To ${fmt.title(fmt.pick(list[0].first, "dest", lang))}`),
          ...list.map((group) => card.row({ leading: { text: `Stop ${group.first.seq}` }, title: "", trailing: etaChips(group) })),
        ]
      : null;
  return {
    ...brand(operator, result.input?.route ?? operator.badge),
    title: `Arrivals along route ${result.input?.route ?? ""}`.trim(),
    blocks: groups.length
      ? blocks(direction(groups.filter((group) => group.first.dir !== "I")), direction(groups.filter((group) => group.first.dir === "I")))
      : [card.text("No buses are running on this route right now.", true)],
  };
}

// ------------------------------------------------------------ green minibus

const REGIONS: Record<string, string> = { HKI: "Hong Kong Island", KLN: "Kowloon", NT: "New Territories" };

const gmbEtas = (etas: Row[] | undefined) => card.etas((etas ?? []).map((eta) => fmt.eta(eta.timestamp)));

function gmbRoutes(result: CardInput, operator: Operator): Card {
  const codes: string[] = result.data ?? [];
  return {
    ...brand(operator),
    title: `Minibus routes, ${REGIONS[result.input?.region] ?? result.input?.region ?? ""}`,
    subtitle: fmt.plural(codes.length, "route"),
    blocks: codes.length ? [card.chips(codes.slice(0, 80).map((code) => ({ text: String(code) })))] : [card.text("No routes in this region.", true)],
  };
}

function gmbRoute(result: CardInput, operator: Operator): Card {
  const variants: Row[] = result.data ?? [];
  const lang = langOf(result.input);
  const headway = (direction: Row) => {
    const first = direction.headways?.[0];
    if (!first?.frequency) return null;
    return `Every ${first.frequency}${first.frequency_upper ? `–${first.frequency_upper}` : ""} min from ${String(first.start_time).slice(0, 5)}`;
  };
  return {
    ...brand(operator, result.input?.route ?? operator.badge),
    title: `Minibus ${result.input?.route ?? ""}`.trim(),
    subtitle: REGIONS[result.input?.region] ?? result.input?.region ?? null,
    blocks: variants.length
      ? variants.flatMap((variant) => [
          card.section(fmt.pick(variant, "description", lang) || `Route ${variant.route_code}`),
          ...(variant.directions ?? []).map((direction: Row) =>
            card.row({
              title: `${fmt.pick(direction, "orig", lang)} → ${fmt.pick(direction, "dest", lang)}`,
              subtitle: [headway(direction), fmt.pick(direction, "remarks", lang)].filter(Boolean).join(" · ") || null,
            }),
          ),
        ])
      : [card.text("No minibus route with that number in this region.", true)],
  };
}

function gmbRouteStops(result: CardInput, operator: Operator): Card {
  const list: Row[] = result.data ?? [];
  const lang = langOf(result.input);
  return {
    ...brand(operator),
    title: "Minibus stops",
    subtitle: fmt.plural(list.length, "stop"),
    blocks: list.map((item) => card.row({ leading: { text: String(item.stop_seq) }, title: fmt.title(fmt.pick(item, "name", lang)) })),
  };
}

function gmbStopEta(result: CardInput, operator: Operator): Card {
  const list: Row[] = (result.data ?? []).filter((item: Row) => item.enabled !== false);
  return {
    ...brand(operator),
    title: "Minibus arrivals",
    subtitle: `Stop ${result.input?.stopId ?? ""}`.trim(),
    blocks: list.length
      ? list.map((item) =>
          card.row({ leading: { text: String(item.route_id), tone: "accent" }, title: `Direction ${item.route_seq}`, subtitle: `Stop ${item.stop_seq} on the route`, trailing: gmbEtas(item.eta) }),
        )
      : [card.text("No minibuses are due at this stop right now.", true)],
  };
}

function gmbRouteStopEta(result: CardInput, operator: Operator): Card {
  const data: Row = result.data ?? {};
  const etas = gmbEtas(data.eta);
  return {
    ...brand(operator),
    title: "Minibus arrivals",
    subtitle: `Route ${result.input?.routeId ?? ""}, stop ${result.input?.stopSeq ?? ""}`,
    blocks:
      data.enabled === false
        ? [card.notice("Arrival times are not available for this stop.", "warning")]
        : [card.row({ title: "Next minibuses", trailing: etas.length ? etas : [{ text: "No departures" }] })],
  };
}

// ------------------------------------------------------------ New Lantao Bus

/** NLB's notes carry HTML line breaks. */
const plainText = (text: unknown) => String(text ?? "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").trim();

function nlbRoutes(result: CardInput, operator: Operator): Card {
  const list: Row[] = result.data ?? [];
  const lang = langOf(result.input);
  return {
    ...brand(operator),
    title: result.input?.route ? `Route ${result.input.route}` : `${operator.name} routes`,
    subtitle: fmt.plural(list.length, "route"),
    blocks: list.length
      ? list.map((route) =>
          card.row({
            leading: { text: String(route.routeNo), tone: "accent" },
            title: fmt.pick(route, "routeName", lang),
            subtitle: [route.overnightRoute ? "Overnight" : null, route.specialRoute ? "Special service" : null].filter(Boolean).join(" · ") || null,
          }),
        )
      : [card.text("No routes match.", true)],
    footer: truncation(result),
  };
}

function nlbRouteStops(result: CardInput, operator: Operator): Card {
  const list: Row[] = result.data ?? [];
  const lang = langOf(result.input);
  return {
    ...brand(operator),
    title: `${operator.name} stops`,
    subtitle: fmt.plural(list.length, "stop"),
    blocks: list.map((stop, index) => card.row({ leading: { text: String(index + 1) }, title: fmt.pick(stop, "stopName", lang), subtitle: fmt.pick(stop, "stopLocation", lang) || null })),
  };
}

function nlbEta(result: CardInput, operator: Operator): Card {
  const body: Row = result.data ?? {};
  const arrivals: Row[] = body.estimatedArrivals ?? [];
  const etas = card.etas(arrivals.map((item) => fmt.eta(item.estimatedArrivalTime)));
  const variant = arrivals.find((item) => item.routeVariantName)?.routeVariantName;
  return {
    ...brand(operator),
    title: `${operator.name} arrivals`,
    subtitle: `Route ${result.input?.routeId ?? ""}, stop ${result.input?.stopId ?? ""}`,
    blocks: [card.row({ title: "Next buses", subtitle: variant || null, trailing: etas.length ? etas : [{ text: "No departures" }] })],
    footer: plainText(body.message) || null,
  };
}

// ------------------------------------------------------------ MTR Bus

function mtrBus(result: CardInput, operator: Operator): Card {
  const body: Row = result.data ?? {};
  const stops: Row[] = body.busStop ?? [];
  const route = body.routeName ?? result.input?.routeName ?? "";
  const colour = String(body.routeColour ?? "").replace(/[^0-9a-f]/gi, "").slice(0, 6);
  return {
    ...brand(operator, route || operator.badge),
    ...(colour.length === 6 ? { accent: `#${colour}` } : {}),
    title: `MTR Bus ${route}`.trim(),
    subtitle: body.routeStatusRemarkTitle || null,
    blocks: blocks(
      body.routeStatusRemarkContent && card.notice(body.routeStatusRemarkContent, "warning"),
      stops.length
        ? stops.map((stop) => {
            const buses: Row[] = (stop.bus ?? []).slice(0, 3);
            return card.row({
              title: String(stop.busStopId),
              subtitle: stop.isSuspended === "1" ? "Suspended" : stop.busStopRemark,
              trailing: buses.length ? card.etas(buses.map((item) => item.departureTimeText || item.arrivalTimeText || "—")) : [{ text: "No buses" }],
            });
          })
        : card.text("No stops reported for this route.", true),
    ),
  };
}

// ------------------------------------------------------------ trams

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function tramRoutes(result: CardInput, operator: Operator): Card {
  const list: Row[] = result.data ?? [];
  const lang = langOf(result.input);
  return {
    ...brand(operator),
    title: "Tram routes",
    subtitle: fmt.plural(list.length, "route"),
    blocks: list.length
      ? list.map((route) => card.row({ leading: { text: String(route.route), tone: "accent" }, title: `${fmt.pick(route, "orig", lang)} → ${fmt.pick(route, "dest", lang)}` }))
      : [card.text("No routes match.", true)],
  };
}

function tramStops(result: CardInput, operator: Operator): Card {
  const list: Row[] = result.data ?? [];
  const lang = langOf(result.input);
  const directions = [...new Set(list.map((stop) => String(stop.direction)))];
  return {
    ...brand(operator),
    title: result.input?.search ? `Tram stops matching “${result.input.search}”` : "Tram stops",
    subtitle: fmt.plural(list.length, "stop"),
    blocks: list.length
      ? directions.flatMap((direction) => [
          card.section(capitalise(direction)),
          ...list.filter((stop) => stop.direction === direction).map((stop) => card.row({ leading: { text: String(stop.stop) }, title: fmt.pick(stop, "name", lang) })),
        ])
      : [card.text("No stops match.", true)],
    footer: truncation(result),
  };
}

const builders: Record<string, (result: CardInput, operator: Operator) => Card> = {
  kmb_routes: routes,
  kmb_stops: stops,
  kmb_route_stops: routeStops,
  kmb_stop_eta: stopEta,
  kmb_route_eta: routeEta,
  citybus_routes: routes,
  citybus_route_stops: routeStops,
  citybus_eta: stopEta,
  nlb_routes: nlbRoutes,
  nlb_route_stops: nlbRouteStops,
  nlb_eta: nlbEta,
  mtr_bus_schedule: mtrBus,
  gmb_routes: gmbRoutes,
  gmb_route: gmbRoute,
  gmb_route_stops: gmbRouteStops,
  gmb_stop_eta: gmbStopEta,
  gmb_route_stop_eta: gmbRouteStopEta,
  tram_routes: tramRoutes,
  tram_stops: tramStops,
};

export const buildCard: CardBuilder = (result) => builders[result.tool]?.(result, operatorOf(result.tool)) ?? null;
