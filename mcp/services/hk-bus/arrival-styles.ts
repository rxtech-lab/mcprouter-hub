// Scoped to the bus app so the other service cards retain their own layouts.
export const ARRIVAL_STYLES = `
.bus-board { display:flex; flex-direction:column; gap:16px }
.bus-board-header { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:4px 2px }
.bus-board-header h1 { font-size:20px; font-weight:600; letter-spacing:-.02em }
.bus-eyebrow { color:var(--text-2); font-size:11px; font-weight:600; letter-spacing:.06em }
.bus-stop-label { display:flex; align-items:center; gap:4px; margin-top:6px; color:var(--text-2); font-size:12px; overflow-wrap:anywhere }
.bus-arrival-list { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr)); gap:12px }
.bus-arrival-card { min-width:0; background:var(--surface); border:1px solid var(--border); border-radius:20px; padding:20px; animation:rise 350ms var(--ease) both }
.bus-route-heading { display:flex; align-items:center; gap:14px }
.bus-route-heading .badge { height:48px; min-width:60px; border-radius:14px; font-size:24px; letter-spacing:-.04em }
.bus-destination { min-width:0 }
.bus-destination h2 { font-size:16px; line-height:1.35; font-weight:600; overflow-wrap:anywhere }
.bus-alternate { font-size:12px; color:var(--text-2); margin-top:3px; overflow-wrap:anywhere }
.bus-next { display:flex; justify-content:space-between; align-items:end; gap:12px; margin-top:24px }
.bus-countdown { display:block; font-size:36px; line-height:1.2; letter-spacing:-.04em; font-weight:600; font-variant-numeric:tabular-nums; margin-top:4px }
.bus-clock { color:var(--text-2); font-size:14px; padding-bottom:4px; font-variant-numeric:tabular-nums }
.bus-no-arrivals { color:var(--text-2); margin-top:6px; font-size:15px }
.bus-remark { color:var(--text-2); font-size:12px; margin-top:10px }
.bus-card-footer { display:flex; justify-content:space-between; align-items:center; gap:8px; border-top:1px solid var(--border); margin-top:20px; padding-top:12px }
.bus-later { display:flex; align-items:center; gap:10px; font-size:13px; font-variant-numeric:tabular-nums; flex-wrap:wrap }
.bus-card-footer .button { min-height:40px; flex-shrink:0 }
.bus-dialog { width:min(560px,calc(100vw - 32px)); max-height:calc(100dvh - 32px); margin:auto; border:1px solid var(--border); border-radius:24px; padding:24px; color:var(--text); background:var(--bg); box-shadow:0 24px 80px #0005 }
.bus-dialog[open] { animation:rise 300ms var(--ease) both }
.bus-dialog::backdrop { background:#0009; backdrop-filter:blur(4px) }
.bus-dialog-header { display:flex; align-items:start; justify-content:space-between; gap:12px; margin-bottom:24px }
.bus-dialog-header h2 { font-size:20px; overflow-wrap:anywhere }
.bus-dialog-header .button { flex-shrink:0; min-height:40px }
.bus-timetable { list-style:none; padding:0; margin:8px 0 0 }
.bus-timetable li { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:16px 0; border-bottom:1px solid var(--border); font-size:14px }
.bus-timetable p { font-size:12px; margin-top:4px }
.bus-time-small { flex-shrink:0; font-size:12px; color:var(--text-2) }
.bus-status { position:fixed; z-index:10; bottom:16px; left:50%; transform:translateX(-50%); width:max-content; max-width:calc(100% - 32px); padding:12px 20px; border-radius:16px; background:var(--text); color:var(--bg); box-shadow:0 8px 32px #0004 }
@media(max-width:400px) { .bus-arrival-card { padding:16px } .bus-countdown { font-size:30px } .bus-dialog { padding:20px } }
`;
