/* eslint-disable @typescript-eslint/no-require-imports -- Postman runs CommonJS handlers. */
// Synthetic TD car-park envelope matching the service.yaml response root/pick contract.
// No provider-owned mock was searched: this local Postman session is signed out.
const http = require("node:http");
let attempts = 0;
http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (req.method !== "GET" || url.pathname !== "/v1/carpark-info-vacancy" || url.searchParams.get("data") !== "info") {
    res.writeHead(501).end("Endpoint not modeled"); return;
  }
  attempts++;
  if (attempts <= 2 || url.searchParams.get("vehicleTypes") === "HGV") {
    res.writeHead(503).end("<html>Temporary maintenance</html>"); return;
  }
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ results: [{ park_Id: "simulation-only", name: "Simulated car park", displayAddress: "Test address", district: "Test district", latitude: 22.3, longitude: 114.2 }] }));
}).listen(process.env.PORT);
