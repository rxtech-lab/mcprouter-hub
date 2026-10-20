/* eslint-disable @typescript-eslint/no-require-imports -- Postman runs CommonJS handlers. */
// Contract-shaped fixtures from https://docs.mapbox.com/api/navigation/directions/.
// Synthetic paths, not navigation data. Profiles select success/no-route/outage.
const http = require("node:http");
http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const match = url.pathname.match(/^\/directions\/v5\/mapbox\/(walking|cycling|driving)\/([^/]+)$/);
  if (req.method !== "GET" || !match) { res.writeHead(501); return res.end("Endpoint not modeled"); }
  if (!url.searchParams.get("access_token") || url.searchParams.get("geometries") !== "geojson" || url.searchParams.get("overview") !== "simplified") {
    res.writeHead(422); return res.end("Invalid directions request");
  }
  if (match[1] === "driving") { res.writeHead(503); return res.end("<html>Maintenance</html>"); }
  res.setHeader("Content-Type", "application/json");
  if (match[1] === "cycling") return res.end(JSON.stringify({ code: "NoRoute", routes: [] }));
  const points = match[2].split(";").map((pair) => pair.split(",").map(Number));
  if (points[0][0] === 0) return res.end(JSON.stringify({ code: "Ok", routes: [{ geometry: { type: "LineString", coordinates: [[200, 100]] } }] }));
  res.end(JSON.stringify({ code: "Ok", routes: [{ distance: 1200, duration: 900, geometry: { type: "LineString", coordinates: [points[0], [114.159, 22.287], ...points.slice(1)] } }] }));
}).listen(process.env.PORT || 4904);
