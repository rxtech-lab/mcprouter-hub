# Agent maps

Web chat offers `show_map` alongside `show_ui` and `show_tool_ui`, including provider-scoped chat. It places a map in the assistant's reply, preserved with the tool input in chat history. Telegram and WhatsApp do not receive this web-only tool.

Input: `{ title, pins, routes }`. Use empty arrays for unused collections. A pin has `{ label, latitude, longitude, description? }`; a route has `{ label, coordinates: [{ latitude, longitude }, ...] }`. All coordinates use decimal degrees. Limits: 50 pins, 5 routes, 2–1,000 coordinates per route, valid latitudes/longitudes, and at least one pin or route.

Coordinates must come from the user or tool results. This tool displays geometry; it does not geocode, find directions, or snap to roads. When only stops or destinations are known, show pins and omit routes.

Maps fit their data, support dragging, zooming, selecting pins, and resetting the view. Expand opens a native dialog with a backdrop; Escape or Close map dismisses it. A tile failure leaves overlays and labels available with a status message.

The browser loads only visible 256px raster tiles using [Mapbox Dark v11](https://docs.mapbox.com/map-styles/reference/dark/), with normal browser caching. Shared-location previews use the same map canvas and styling. Pins and route geometry remain local SVG overlays; there is no routing/geocoding request.

Set `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` to a Mapbox public (`pk.`) token before building. Existing `MAPBOX_API_KEY` configuration is accepted when it contains a public token. Secret tokens are never copied to the browser bundle. Missing or failed tile configuration leaves pins and routes visible with the existing unavailable status. Configuration changes require a rebuild/restart. The map includes the official Mapbox logo and Mapbox, OpenStreetMap and feedback attribution links. See [Mapbox Static Tiles](https://docs.mapbox.com/api/maps/static-tiles/) and [attribution](https://docs.mapbox.com/help/dive-deeper/attribution/).

Browser checks intercept tile requests with deterministic dark fixtures; they verify styling URLs, attribution and interactions rather than live Mapbox availability.
