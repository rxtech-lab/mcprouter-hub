// Hong Kong Observatory chat cards: the same views as app.ts, as still pictures.
import { asList, blocks, card, fmt, type Card, type CardBuilder, type CardInput, type Row, type Tone } from "../../apps/card";

const ACCENT = "#1565c0";
const base = { accent: ACCENT, badge: "HKO" };

function current({ data = {} }: CardInput): Card {
  const temperatures: Row[] = data.temperature?.data ?? [];
  const main = temperatures.find((item) => /observatory|天文台/i.test(item.place)) ?? temperatures[0];
  const humidity = data.humidity?.data?.[0];
  const uv = data.uvindex?.data?.[0];
  const rain: Row[] = (data.rainfall?.data ?? []).filter((item: Row) => Number(item.max) > 0);
  return {
    ...base,
    title: "Current weather",
    subtitle: main?.place ?? null,
    blocks: blocks(
      card.hero(main ? `${main.value}°C` : "—", main?.place),
      asList(data.warningMessage).map((text) => card.notice(text, "warning")),
      asList(data.tcmessage).map((text) => card.notice(text, "danger")),
      card.stats([
        humidity && { label: "Humidity", value: `${humidity.value}%` },
        uv && { label: "UV index", value: `${uv.value}${uv.desc ? ` ${uv.desc}` : ""}` },
        { label: "Rain (past hour)", value: rain.length ? `${Math.max(...rain.map((item) => Number(item.max)))} mm max` : "None" },
      ]),
      asList(data.specialWxTips).map((text) => card.notice(text, "info")),
    ),
    footer: data.updateTime ? `Updated ${fmt.time(data.updateTime)}` : null,
  };
}

function local({ data = {} }: CardInput): Card {
  return {
    ...base,
    title: data.forecastPeriod || "Local forecast",
    subtitle: data.updateTime ? `Issued ${fmt.dateTime(data.updateTime)}` : null,
    blocks: blocks(
      data.tcInfo && card.notice(data.tcInfo, "danger"),
      data.fireDangerWarning && card.notice(data.fireDangerWarning, "warning"),
      data.forecastDesc && card.text(data.forecastDesc),
      data.outlook && card.text(`Outlook: ${data.outlook}`, true),
    ),
  };
}

function nineDay({ data = {} }: CardInput): Card {
  const days: Row[] = data.weatherForecast ?? [];
  return {
    ...base,
    badge: "9",
    title: "9-day forecast",
    subtitle: data.updateTime ? `Updated ${fmt.dateTime(data.updateTime)}` : null,
    blocks: days.map((day) => {
      const date = String(day.forecastDate);
      const iso = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T12:00:00+08:00`;
      return card.row({
        leading: { text: fmt.day(iso, { month: undefined }) },
        title: day.forecastWeather ?? "",
        subtitle: day.PSR ? `Chance of rain: ${day.PSR}` : null,
        trailing: [
          { text: `${day.forecastMaxtemp?.value}°`, tone: "accent" },
          { text: `${day.forecastMintemp?.value}°` },
        ],
      });
    }),
  };
}

const WARNING_TONES: Record<string, Tone> = { Red: "danger", Black: "danger", Amber: "warning", Yellow: "warning" };

function warnings({ data = {} }: CardInput): Card {
  const items: Row[] = Object.values(data).filter((item: Row) => item?.name);
  return {
    ...base,
    title: "Weather warnings",
    subtitle: items.length ? `${items.length} in force` : null,
    blocks: items.length
      ? items.map((item) =>
          card.row({
            leading: { text: item.type || item.code, tone: WARNING_TONES[item.type] ?? "info" },
            title: item.name,
            subtitle: item.issueTime ? `Issued ${fmt.dateTime(item.issueTime)}` : null,
          }),
        )
      : [card.notice("No weather warnings are in force.", "success")],
  };
}

function warningDetails({ data = {} }: CardInput): Card {
  const details: Row[] = data.details ?? [];
  return {
    ...base,
    title: "Warning details",
    blocks: details.length ? details.flatMap((item) => asList(item.contents).map((text) => card.text(text))) : [card.notice("No weather warnings are in force.", "success")],
  };
}

function tips({ data = {} }: CardInput): Card {
  const items: Row[] = data.swt ?? [];
  return {
    ...base,
    title: "Special weather tips",
    blocks: items.length ? items.map((item) => card.notice(item.desc ?? String(item), "info")) : [card.text("No special weather tips right now.", true)],
  };
}

function earthquake({ data = {} }: CardInput): Card | null {
  if (data.mag === undefined) return null;
  const tone: Tone = data.mag >= 6 ? "danger" : data.mag >= 4.5 ? "warning" : "info";
  return {
    ...base,
    title: "Earthquake report",
    blocks: [card.hero(`M${data.mag}`, data.region, `${fmt.dateTime(data.ptime)} (Hong Kong time) · ${data.lat}, ${data.lon}`, tone)],
  };
}

function lunar({ data = {}, input }: CardInput): Card {
  return {
    ...base,
    badge: "農",
    title: "Lunar calendar",
    subtitle: input?.date ? fmt.day(`${input.date}T12:00:00+08:00`, { year: "numeric" }) : null,
    blocks: [card.hero(data.LunarDate || "—", data.LunarYear)],
  };
}

const builders: Record<string, CardBuilder> = {
  hko_current_weather: current,
  hko_local_forecast: local,
  hko_nine_day_forecast: nineDay,
  hko_warning_summary: warnings,
  hko_warning_details: warningDetails,
  hko_special_weather_tips: tips,
  hko_earthquake: earthquake,
  hko_lunar_date: lunar,
};

export const buildCard: CardBuilder = (result) => builders[result.tool]?.(result) ?? null;
