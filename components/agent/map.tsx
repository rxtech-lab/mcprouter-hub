"use client";

import Image from "next/image";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Expand, LocateFixed, Minus, Plus, X } from "lucide-react";
import { MAP_HEIGHT, MAP_WIDTH, ROUTE_COLORS, mapGeometry, type AgentMap } from "@/lib/agent/map";
import { useT } from "@/lib/i18n/client";

/** Raster basemap with local SVG overlays: no coordinates or labels sent to a geocoding service. */
export function MapCanvas({ map }: { map: AgentMap }) {
  const t = useT();
  const geometry = useMemo(() => mapGeometry(map), [map]);
  const [view, setView] = useState(geometry.view);
  const [selected, setSelected] = useState<number | null>(null);
  const [tileError, setTileError] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  // Old messages outside the chat viewport must not download tiles in the background.
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    if (viewport.current) observer.observe(viewport.current);
    return () => observer.disconnect();
  }, []);
  const drag = useRef<{ x: number; y: number; width: number; view: typeof view } | null>(null);
  const scale = 256 * 2 ** view.zoom;
  const left = view.x * scale - MAP_WIDTH / 2;
  const top = view.y * scale - MAP_HEIGHT / 2;
  const screen = (point: { latitude: number; longitude: number }) => {
    const p = geometry.project(point);
    return { x: p.x * scale - left, y: p.y * scale - top };
  };
  const tiles = [];
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const count = 2 ** view.zoom;
  for (let x = Math.floor(left / 256); x <= Math.floor((left + MAP_WIDTH) / 256); x++) {
    for (let y = Math.max(0, Math.floor(top / 256)); y <= Math.min(count - 1, Math.floor((top + MAP_HEIGHT) / 256)); y++) {
      if (token) tiles.push(<image key={`${view.zoom}/${x}/${y}`} href={`https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/256/${view.zoom}/${((x % count) + count) % count}/${y}?access_token=${encodeURIComponent(token)}`} x={x * 256 - left} y={y * 256 - top} width="256" height="256" onError={() => setTileError(true)} />);
    }
  }
  const controlClass = "state-layer flex size-10 items-center justify-center rounded-full bg-[#252a30] text-white shadow-elevation-1 disabled:opacity-40";
  return (
    <div>
      <div ref={viewport} className="relative overflow-hidden rounded-md border border-outline-variant bg-[#191a1a]" data-testid="agent-map-canvas">
        <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} className="block min-h-48 w-full touch-none cursor-grab active:cursor-grabbing" role="group" aria-label={map.title}
          onPointerDown={(event) => {
            if ((event.target as Element).closest('[role="button"]')) return;
            drag.current = { x: event.clientX, y: event.clientY, width: event.currentTarget.getBoundingClientRect().width, view };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const start = drag.current;
            if (!start) return;
            const ratio = MAP_WIDTH / start.width / scale;
            setView({ ...start.view, x: start.view.x - (event.clientX - start.x) * ratio, y: Math.max(0, Math.min(1, start.view.y - (event.clientY - start.y) * ratio)) });
          }}
          onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}>
          {visible ? tiles : null}
          {map.routes.map((route, index) => {
            const points = route.coordinates.map((point) => { const p = screen(point); return `${p.x},${p.y}`; }).join(" ");
            return <g key={index} data-testid="map-route"><title>{route.label}</title><polyline points={points} fill="none" stroke="#101418" strokeWidth="7" strokeLinejoin="round" strokeLinecap="round" /><polyline points={points} fill="none" stroke={ROUTE_COLORS[index]} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" /></g>;
          })}
          {map.pins.map((pin, index) => {
            const p = screen(pin);
            return <g key={index} transform={`translate(${p.x} ${p.y})`} role="button" tabIndex={0} aria-label={`${index + 1}. ${pin.label}`} aria-pressed={selected === index} className="cursor-pointer outline-none focus:stroke-black" onClick={() => setSelected(index)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(index); } }}>
              <title>{pin.label}</title><path d="M0 0 C-4 -8 -13 -14 -13 -23 A13 13 0 1 1 13 -23 C13 -14 4 -8 0 0Z" fill={selected === index ? "#7b1fa2" : "#1565c0"} stroke="white" strokeWidth="2" /><text y="-19" textAnchor="middle" fill="white" stroke="none" fontSize="12" fontWeight="bold">{index + 1}</text>
            </g>;
          })}
        </svg>
        <div className="absolute right-2 top-2 flex flex-col gap-2">
          <button type="button" aria-label={t("Zoom in")} className={controlClass} disabled={view.zoom >= 18} onClick={() => setView({ ...view, zoom: view.zoom + 1 })}><Plus size={18} /></button>
          <button type="button" aria-label={t("Zoom out")} className={controlClass} disabled={view.zoom <= 0} onClick={() => setView({ ...view, zoom: view.zoom - 1 })}><Minus size={18} /></button>
          <button type="button" aria-label={t("Fit map")} className={controlClass} onClick={() => { setView(geometry.view); setTileError(false); }}><LocateFixed size={18} /></button>
        </div>
        <a href="https://www.mapbox.com/" target="_blank" rel="noopener noreferrer" className="absolute bottom-6 left-2"><Image src="/mapbox-logo.svg" alt="Mapbox" width="88" height="23" /></a>
        <div className="absolute bottom-0 right-0 flex flex-wrap justify-end gap-x-1 bg-black/85 px-1 text-[10px] text-white">
          <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener noreferrer" className="underline">© Mapbox</a>
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">© OpenStreetMap contributors</a>
          <a href={`https://apps.mapbox.com/feedback/#/${view.x * 360 - 180}/${Math.atan(Math.sinh(Math.PI * (1 - 2 * view.y))) * 180 / Math.PI}/${view.zoom}`} target="_blank" rel="noopener noreferrer" className="underline">{t("Improve this map")}</a>
        </div>
        {tileError || !token ? <p role="status" className="absolute bottom-12 left-2 right-2 rounded-sm bg-surface/95 p-2 type-body-small text-on-surface">{t("Map tiles are unavailable. Pins and routes are still shown.")}</p> : null}
      </div>
      {map.routes.length ? <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 type-body-small">{map.routes.map((route, index) => <li key={index} className="flex items-center gap-2"><span aria-hidden className="h-1 w-5 rounded-full" style={{ backgroundColor: ROUTE_COLORS[index] }} />{route.label}</li>)}</ul> : null}
      {map.pins.length ? <div className="mt-2 flex flex-wrap gap-1">{map.pins.map((pin, index) => <button type="button" key={index} aria-pressed={selected === index} onClick={() => { setSelected(index); const p = geometry.project(pin); setView({ ...view, ...p }); }} className="state-layer min-h-10 rounded-full px-3 type-label-medium text-primary aria-pressed:bg-primary-container">{index + 1}. {pin.label}</button>)}</div> : null}
      {selected !== null ? <p className="mt-2 type-body-small" aria-live="polite">{map.pins[selected].description ?? map.pins[selected].label} <a className="text-primary underline" href={`https://www.openstreetmap.org/?mlat=${map.pins[selected].latitude}&mlon=${map.pins[selected].longitude}#map=16/${map.pins[selected].latitude}/${map.pins[selected].longitude}`} target="_blank" rel="noopener noreferrer">{t("Open in OpenStreetMap")}</a></p> : null}
    </div>
  );
}

/** The inline map stays in the message; exploration has its own native dialog. */
export function AgentMapCard({ map }: { map: AgentMap }) {
  const t = useT();
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [expanded, setExpanded] = useState(false);
  return (
    <section className="my-3 rounded-lg border border-outline-variant bg-surface-container-low p-3 animate-message-in" data-testid="agent-map">
      <header className="mb-2 flex items-center justify-between gap-2"><h3 className="type-title-medium">{map.title}</h3><button type="button" aria-label={t("Expand map")} className="state-layer flex size-10 shrink-0 items-center justify-center rounded-full text-primary" onClick={() => { setExpanded(true); dialog.current?.showModal(); }}><Expand size={18} /></button></header>
      <MapCanvas map={map} />
      <dialog ref={dialog} aria-labelledby={id} onClose={() => setExpanded(false)} onKeyDown={(event) => { if (event.key === "Escape") event.stopPropagation(); }} onClick={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.target === event.currentTarget && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.current?.close();
      }} className="fixed inset-0 m-auto max-h-[90dvh] w-[min(1000px,calc(100vw-24px))] overflow-y-auto rounded-xl bg-surface-container-high p-4 text-on-surface shadow-elevation-3 backdrop:bg-scrim/40 open:animate-message-in">
        <header className="mb-3 flex items-center justify-between gap-3"><h2 id={id} className="type-title-large">{map.title}</h2><button type="button" aria-label={t("Close map")} className="state-layer flex size-10 items-center justify-center rounded-full" onClick={() => dialog.current?.close()}><X size={20} /></button></header>
        {expanded ? <MapCanvas map={map} /> : null}
      </dialog>
    </section>
  );
}
