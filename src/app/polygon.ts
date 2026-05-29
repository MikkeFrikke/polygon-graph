/**
 * A single polygon vertex in WGS84 degrees.
 */
export interface PolygonVertex {
  lat: number;
  lon: number;
}

/**
 * Parse a JSON string into a list of polygon vertices.
 *
 * The documented input schema is a flat array of `[lat, lon]` pairs in WGS84,
 * e.g. `[[47.3769, 8.5417], [47.3780, 8.5450], [47.3750, 8.5460]]`.
 *
 * This performs structural conversion only; range and minimum-vertex
 * validation is added in Task 03. Malformed JSON propagates as the native
 * `SyntaxError` thrown by `JSON.parse`.
 */
export function parsePolygon(json: string): PolygonVertex[] {
  const data = JSON.parse(json) as unknown;

  if (!Array.isArray(data)) {
    throw new Error('Expected a JSON array of [lat, lon] pairs.');
  }

  return data.map((pair) => {
    const [lat, lon] = pair as [number, number];
    return { lat, lon };
  });
}
