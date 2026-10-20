import { tool } from "ai";
import { z } from "zod";

export const REQUEST_LOCATION_TOOL_NAME = "request_user_location";
const LOCATION_ANSWER_PREFIX = "I chose to share my current location for this answer: ";
const sharedLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().nonnegative(),
  capturedAt: z.iso.datetime(),
});

/** Recognise our location messages without changing ordinary text or malformed payloads. */
export function parseLocationAnswer(text: string) {
  if (!text.startsWith(LOCATION_ANSWER_PREFIX)) return null;
  try {
    const parsed = sharedLocationSchema.safeParse(JSON.parse(text.slice(LOCATION_ANSWER_PREFIX.length)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
export const locationRequestSchema = z.object({
  reason: z.string().trim().min(1).max(500).describe("Explain in the user's language why their current location is needed."),
});

export const LOCATION_NOTE = `For questions or tools that need the user's current location (for example nearby stops, parking, or weather near me), call request_user_location when no suitable location has been provided. Explain why in the user's language. This only asks for permission: it does not return coordinates. Stop and wait for the user's next message. Never guess their location or treat the request as consent. If they decline or location is unavailable, ask for a place, district, address, or stop using request_user_input instead; do not repeatedly request location. Use supplied coordinates only for the requested answer and respect the reported accuracy and capture time; ask again if a later request needs a fresh location. Do not request device location for questions about an explicitly named place.`;

export function locationTools() {
  return {
    [REQUEST_LOCATION_TOOL_NAME]: tool({
      description: "Ask permission to share the user's current browser location for a location-dependent answer. Pauses this reply; coordinates arrive only in a subsequent user message after consent.",
      inputSchema: locationRequestSchema,
      execute: async () => ({ awaitingUserLocation: true }),
    }),
  };
}

/** Only share the fields needed for a nearby search, not the complete device position. */
export function locationAnswer(position: Pick<GeolocationPosition, "coords" | "timestamp">) {
  const { latitude, longitude, accuracy } = position.coords;
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180 || !Number.isFinite(accuracy) || accuracy < 0 || !Number.isFinite(position.timestamp)) {
    throw new Error("Invalid location");
  }
  return `${LOCATION_ANSWER_PREFIX}${JSON.stringify({ latitude: Number(latitude.toFixed(5)), longitude: Number(longitude.toFixed(5)), accuracyMeters: Math.ceil(accuracy), capturedAt: new Date(position.timestamp).toISOString() })}`;
}
