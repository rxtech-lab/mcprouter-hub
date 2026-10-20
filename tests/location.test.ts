import { describe, expect, it } from "vitest";
import { locationAnswer, parseLocationAnswer, locationRequestSchema, locationTools } from "@/lib/agent/location";

describe("location requests", () => {
  it("leaves normal text and invalid location messages as plain text", () => {
    const prefix = "I chose to share my current location for this answer: ";
    expect(parseLocationAnswer("Meet me in Osaka")).toBeNull();
    expect(parseLocationAnswer(prefix + "{broken}")).toBeNull();
    expect(parseLocationAnswer(prefix + JSON.stringify({ latitude: 999, longitude: 135, accuracyMeters: 35, capturedAt: "invalid" }))).toBeNull();
  });
  it("pauses for consent without claiming to have a location", async () => {
    expect(locationRequestSchema.safeParse({ reason: " " }).success).toBe(false);
    expect(await locationTools().request_user_location.execute!({ reason: "Find nearby parking" }, { toolCallId: "location", messages: [], context: {} })).toEqual({ awaitingUserLocation: true });
  });

  it("shares only coordinates, accuracy and capture time", () => {
    const position = { coords: { latitude: 22.28123456, longitude: 114.16123456, accuracy: 21.2, altitude: 100, heading: 50, speed: 12 }, timestamp: Date.UTC(2026, 9, 20) } as GeolocationPosition;
    const answer = locationAnswer(position);
    expect(parseLocationAnswer(answer)).toMatchObject({ latitude: 22.28123, longitude: 114.16123, accuracyMeters: 22 });
    expect(JSON.parse(answer.slice(answer.indexOf("{")))).toEqual({ latitude: 22.28123, longitude: 114.16123, accuracyMeters: 22, capturedAt: "2026-10-20T00:00:00.000Z" });
    expect(() => locationAnswer({ ...position, coords: { ...position.coords, latitude: NaN } })).toThrow("Invalid location");
  });
});
