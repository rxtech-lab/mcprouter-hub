"use client";

import Image from "next/image";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  const popup = useRef<HTMLDialogElement>(null);
  const popupId = useId();
  const popupTitleId = useId();
  const [visible, setVisible] = useState(false);
  // Old messages outside the chat viewport must not download tiles in the background.
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    if (viewport.current) observer.observe(viewport.current);
    return () => observer.disconnect();
  }, []);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ x: number; y: number; distance: number; view: typeof view } | null>(null);
  const moved = useRef(false);
  // Register a non-passive listener so trackpad pinches zoom this map, not the page.
  useEffect(() => {
    const svg = viewport.current?.querySelector("svg");
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const bounds = svg.getBoundingClientRect();
      const ratio = MAP_WIDTH / bounds.width;
      const x = (event.clientX - bounds.left - bounds.width / 2) * ratio;
      const y = (event.clientY - bounds.top - bounds.height / 2) * ratio;
      setView((current) => {
        const zoom = Math.max(0, Math.min(18, current.zoom - event.deltaY * 0.01));
        const offset = 1 / (256 * 2 ** current.zoom) - 1 / (256 * 2 ** zoom);
        return { zoom, x: current.x + x * offset, y: Math.max(0, Math.min(1, current.y + y * offset)) };
      });
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);
  const startGesture = () => {
    const [a, b] = [...pointers.current.values()];
    gesture.current = a ? { x: b ? (a.x + b.x) / 2 : a.x, y: b ? (a.y + b.y) / 2 : a.y, distance: b ? Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)) : 0, view } : null;
  };
  const endPointer = (pointerId: number) => {
    if (pointers.current.delete(pointerId)) startGesture();
  };
  const scale = 256 * 2 ** view.zoom;
  const left = view.x * scale - MAP_WIDTH / 2;
  const top = view.y * scale - MAP_HEIGHT / 2;
  const screen = (point: { latitude: number; longitude: number }) => {
    const p = geometry.project(point);
    return { x: p.x * scale - left, y: p.y * scale - top };
  };
  const tiles = [];
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const tileZoom = Math.floor(view.zoom);
  const tileSize = 256 * 2 ** (view.zoom - tileZoom);
  const count = 2 ** tileZoom;
  for (let x = Math.floor(left / tileSize); x <= Math.floor((left + MAP_WIDTH) / tileSize); x++) {
    for (let y = Math.max(0, Math.floor(top / tileSize)); y <= Math.min(count - 1, Math.floor((top + MAP_HEIGHT) / tileSize)); y++) {
      if (token) tiles.push(<image key={`${tileZoom}/${x}/${y}`} href={`https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/256/${tileZoom}/${((x % count) + count) % count}/${y}?access_token=${encodeURIComponent(token)}`} x={x * tileSize - left} y={y * tileSize - top} width={tileSize} height={tileSize} onError={() => setTileError(true)} />);
    }
  }
  const selectedPin = selected === null ? null : map.pins[selected];
  const selectPin = (index: number) => {
    setSelected(index);
    const point = geometry.project(map.pins[index]);
    // Leave room above the marker for details, including on narrow screens.
    setView({ ...view, x: point.x, y: point.y - MAP_HEIGHT * 0.3 / scale });
  };
  useLayoutEffect(() => {
    const panel = popup.current;
    const container = viewport.current;
    if (!selectedPin || !panel || !container) return;
    panel.showPopover();
    const position = () => {
      const bounds = container.querySelector("svg")!.getBoundingClientRect();
      const point = geometry.project(selectedPin);
      const ratio = bounds.width / MAP_WIDTH;
      const pinX = bounds.left + (point.x * scale - left) * ratio;
      const pinY = bounds.top + (bounds.height - MAP_HEIGHT * ratio) / 2 + (point.y * scale - top - 36) * ratio;
      const panelBounds = panel.getBoundingClientRect();
      const x = Math.max(8, Math.min(window.innerWidth - panelBounds.width - 8, pinX - panelBounds.width / 2));
      panel.style.left = `${x}px`;
      panel.style.top = `${Math.max(8, pinY - panelBounds.height - 10)}px`;
      panel.style.setProperty("--pin-offset", `${Math.max(16, Math.min(panelBounds.width - 16, pinX - x))}px`);
    };
    position();
    const observer = new ResizeObserver(position);
    observer.observe(container);
    observer.observe(panel);
    window.addEventListener("scroll", position, true);
    window.addEventListener("resize", position);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", position, true);
      window.removeEventListener("resize", position);
    };
  }, [selectedPin, geometry, scale, left, top]);
  const controlClass = "state-layer flex size-10 items-center justify-center rounded-full bg-[#252a30] text-white shadow-elevation-1 disabled:opacity-40";
  return (
    <div>
      <div ref={viewport} className="relative overflow-hidden rounded-md border border-outline-variant bg-[#191a1a]" data-testid="agent-map-canvas">
        <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} className="block min-h-48 w-full touch-none cursor-grab active:cursor-grabbing" role="group" aria-label={map.title}
          onClickCapture={(event) => { if (moved.current) { event.preventDefault(); event.stopPropagation(); } }}
          onPointerDown={(event) => {
            if (event.pointerType === "mouse" && (event.button !== 0 || (event.target as Element).closest('[role="button"]'))) return;
            pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
            moved.current = pointers.current.size > 1;
            startGesture();
            if (!(event.target as Element).closest('[role="button"]')) event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!pointers.current.has(event.pointerId)) return;
            pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
            const start = gesture.current;
            if (!start) return;
            const [a, b] = [...pointers.current.values()];
            const x = b ? (a.x + b.x) / 2 : a.x;
            const y = b ? (a.y + b.y) / 2 : a.y;
            if (b || Math.hypot(x - start.x, y - start.y) > 5) moved.current = true;
            const zoom = Math.max(0, Math.min(18, start.view.zoom + (b && start.distance ? Math.log2(Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)) / start.distance) : 0)));
            const bounds = event.currentTarget.getBoundingClientRect();
            const ratio = MAP_WIDTH / bounds.width;
            const oldScale = 256 * 2 ** start.view.zoom;
            const newScale = 256 * 2 ** zoom;
            setView({ zoom,
              x: start.view.x + (start.x - bounds.left - bounds.width / 2) * ratio / oldScale - (x - bounds.left - bounds.width / 2) * ratio / newScale,
              y: Math.max(0, Math.min(1, start.view.y + (start.y - bounds.top - bounds.height / 2) * ratio / oldScale - (y - bounds.top - bounds.height / 2) * ratio / newScale)),
            });
          }}
          onPointerUp={(event) => endPointer(event.pointerId)} onPointerCancel={(event) => endPointer(event.pointerId)} onLostPointerCapture={(event) => endPointer(event.pointerId)}>
          {visible ? tiles : null}
          {map.routes.map((route, index) => {
            const points = route.coordinates.map((point) => { const p = screen(point); return `${p.x},${p.y}`; }).join(" ");
            return <g key={index} data-testid="map-route"><title>{route.label}</title><polyline points={points} fill="none" stroke="#101418" strokeWidth="7" strokeLinejoin="round" strokeLinecap="round" /><polyline points={points} fill="none" stroke={ROUTE_COLORS[index]} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" /></g>;
          })}
          {map.pins.map((pin, index) => {
            const p = screen(pin);
            return <g key={index} transform={`translate(${p.x} ${p.y})`} role="button" tabIndex={0} aria-label={`${index + 1}. ${pin.label}`} aria-pressed={selected === index} aria-haspopup="dialog" aria-controls={selected === index ? popupId : undefined} className="cursor-pointer outline-none focus:stroke-black" onClick={() => selectPin(index)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectPin(index); } }}>
              <title>{pin.label}</title><path d="M0 0 C-4 -8 -13 -14 -13 -23 A13 13 0 1 1 13 -23 C13 -14 4 -8 0 0Z" fill={selected === index ? "#7b1fa2" : "#1565c0"} stroke="white" strokeWidth="2" /><text y="-19" textAnchor="middle" fill="white" stroke="none" fontSize="12" fontWeight="bold">{index + 1}</text>
            </g>;
          })}
        </svg>
        <div className="absolute right-2 top-2 flex flex-col gap-2">
          <button type="button" aria-label={t("Zoom in")} className={controlClass} disabled={view.zoom >= 18} onClick={() => setView({ ...view, zoom: Math.min(18, view.zoom + 1) })}><Plus size={18} /></button>
          <button type="button" aria-label={t("Zoom out")} className={controlClass} disabled={view.zoom <= 0} onClick={() => setView({ ...view, zoom: Math.max(0, view.zoom - 1) })}><Minus size={18} /></button>
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
      {map.pins.length ? <div className="mt-2 flex gap-1 overflow-x-auto" aria-label={map.title}>{map.pins.map((pin, index) => <button type="button" key={index} aria-pressed={selected === index} aria-haspopup="dialog" aria-controls={selected === index ? popupId : undefined} onClick={() => selectPin(index)} className="state-layer min-h-10 shrink-0 rounded-full px-3 type-label-medium text-primary aria-pressed:bg-primary-container">{index + 1}. {pin.label}</button>)}</div> : null}
      {selectedPin ? <dialog ref={popup} id={popupId} popover="auto" aria-labelledby={popupTitleId} onToggle={(event) => { if (event.newState === "closed") setSelected(null); }} onKeyDown={(event) => {
        // Escape dismisses these details before closing an expanded map or chat.
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); popup.current?.hidePopover(); }
      }} className="fixed inset-auto m-0 w-72 max-w-[calc(100vw-24px)] overflow-visible rounded-lg border border-outline-variant bg-surface-container-high p-3 text-on-surface shadow-elevation-3 popover-open:animate-message-in after:absolute after:top-full after:left-[var(--pin-offset)] after:-ml-2 after:size-4 after:-translate-y-1/2 after:rotate-45 after:border-r after:border-b after:border-outline-variant after:bg-surface-container-high" data-testid="map-pin-popover">
        <div className="relative z-10 max-h-[40dvh] overflow-y-auto">
          <header className="flex items-start gap-2">
            <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-container type-label-medium text-on-primary-container">{selected! + 1}</span>
            <h4 id={popupTitleId} className="min-w-0 flex-1 break-words pt-0.5 type-title-small">{selectedPin.label}</h4>
            <button type="button" aria-label={t("Close")} className="state-layer -mr-1 -mt-1 flex size-10 shrink-0 items-center justify-center rounded-full" onClick={() => popup.current?.hidePopover()}><X size={18} /></button>
          </header>
          {selectedPin.description && selectedPin.description !== selectedPin.label ? <p className="mt-2 whitespace-pre-line break-words type-body-small text-on-surface-variant">{selectedPin.description}</p> : null}
          <a className="state-layer mt-2 inline-flex min-h-10 items-center rounded-full px-2 type-label-medium text-primary underline underline-offset-2" href={`https://www.openstreetmap.org/?mlat=${selectedPin.latitude}&mlon=${selectedPin.longitude}#map=16/${selectedPin.latitude}/${selectedPin.longitude}`} target="_blank" rel="noopener noreferrer">{t("Open in OpenStreetMap")}</a>
        </div>
      </dialog> : null}
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
