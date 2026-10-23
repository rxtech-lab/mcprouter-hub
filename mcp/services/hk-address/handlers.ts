import type { ResponseTransformer } from "@/lib/mcp/types";
import { malformed, page, record } from "@/lib/mcp/spatial";

export const normalize: ResponseTransformer = (body, input) => {
  if (!record(body) || !record(body.RequestAddress) || !Array.isArray(body.SuggestedAddress)) malformed("ALS");
  const rows = body.SuggestedAddress.map((suggestion) => {
    if (!record(suggestion) || !record(suggestion.Address) || !record(suggestion.Address.PremisesAddress)) malformed("ALS");
    const premises = suggestion.Address.PremisesAddress;
    if (!record(premises.EngPremisesAddress) || !record(premises.ChiPremisesAddress)) malformed("ALS");
    const geo = premises.GeospatialInformation;
    const points = geo === undefined ? [] : Array.isArray(geo) ? geo : [geo];
    const coordinates = points.map((point) => {
      if (!record(point) || typeof point.Latitude !== "string" || typeof point.Longitude !== "string" ||
        !point.Latitude.trim() || !point.Longitude.trim() || !Number.isFinite(Number(point.Latitude)) ||
        !Number.isFinite(Number(point.Longitude)) || Math.abs(Number(point.Latitude)) > 90 || Math.abs(Number(point.Longitude)) > 180) malformed("ALS coordinates");
      return { latitude: Number(point.Latitude), longitude: Number(point.Longitude) };
    });
    if (suggestion.ValidationInformation !== undefined && (!record(suggestion.ValidationInformation) ||
      typeof suggestion.ValidationInformation.Score !== "number" || !Number.isFinite(suggestion.ValidationInformation.Score))) malformed("ALS validation score");
    return { ...suggestion, preferredAddress: input.lang === "tc" ? premises.ChiPremisesAddress : premises.EngPremisesAddress, coordinates };
  });
  const offset = Number(input.offset);
  return { language: input.lang, requestAddress: body.RequestAddress, total: rows.length,
    ...page(rows.slice(offset), offset, Number(input.limit)) };
};
