/**
 * A single polygon vertex in WGS84 degrees.
 */
export interface PolygonVertex {
  lat: number;
  lon: number;
}

/**
 * Result of validating raw JSON polygon input.
 *
 * - `empty`   — the input is blank/whitespace only; a neutral, non-error state.
 * - `valid`   — the input parsed and passed every rule; carries the vertices.
 * - `error`   — the input failed a rule; carries a human-readable message
 *               describing the first failing rule.
 */
export type PolygonParseResult =
  | { kind: 'empty' }
  | { kind: 'valid'; vertices: PolygonVertex[] }
  | { kind: 'error'; message: string };

const LAT_MIN = -90;
const LAT_MAX = 90;
const LON_MIN = -180;
const LON_MAX = 180;
const MIN_VERTICES = 3;

/**
 * Validate and parse a JSON string into polygon vertices.
 *
 * The documented input schema is a flat array of `[lat, lon]` pairs in WGS84,
 * e.g. `[[47.3769, 8.5417], [47.3780, 8.5450], [47.3750, 8.5460]]`.
 *
 * Rules are checked in order and the first failure is reported:
 *   1. empty / whitespace-only input is a neutral state (no error)
 *   2. JSON must parse (syntax)
 *   3. the top level must be an array of two-number `[lat, lon]` pairs (structure)
 *   4. every coordinate must be within WGS84 range (range)
 *   5. there must be at least 3 vertices (minimum points)
 *
 * This function never throws for malformed input — failures are returned as an
 * `error` result so callers can render inline feedback.
 */
export function validatePolygon(json: string): PolygonParseResult {
  if (json.trim() === '') {
    return { kind: 'empty' };
  }

  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return { kind: 'error', message: `Invalid JSON syntax: ${detail}` };
  }

  if (!Array.isArray(data)) {
    return { kind: 'error', message: 'Expected a JSON array of [lat, lon] pairs.' };
  }

  const vertices: PolygonVertex[] = [];
  for (let i = 0; i < data.length; i++) {
    const pair = data[i];
    if (
      !Array.isArray(pair) ||
      pair.length !== 2 ||
      typeof pair[0] !== 'number' ||
      typeof pair[1] !== 'number' ||
      !Number.isFinite(pair[0]) ||
      !Number.isFinite(pair[1])
    ) {
      return {
        kind: 'error',
        message: `Entry ${i} must be a [lat, lon] pair of two numbers.`,
      };
    }

    const [lat, lon] = pair as [number, number];
    if (lat < LAT_MIN || lat > LAT_MAX) {
      return {
        kind: 'error',
        message: `Latitude ${lat} at entry ${i} is out of range [${LAT_MIN}, ${LAT_MAX}].`,
      };
    }
    if (lon < LON_MIN || lon > LON_MAX) {
      return {
        kind: 'error',
        message: `Longitude ${lon} at entry ${i} is out of range [${LON_MIN}, ${LON_MAX}].`,
      };
    }

    vertices.push({ lat, lon });
  }

  if (vertices.length < MIN_VERTICES) {
    return {
      kind: 'error',
      message: `A polygon needs at least ${MIN_VERTICES} points (got ${vertices.length}).`,
    };
  }

  return { kind: 'valid', vertices };
}

/**
 * Parse a JSON string into a list of polygon vertices, throwing on any
 * invalid input. Thin wrapper over {@link validatePolygon} kept for callers
 * and tests that expect vertices directly.
 */
export function parsePolygon(json: string): PolygonVertex[] {
  const result = validatePolygon(json);
  if (result.kind !== 'valid') {
    const message = result.kind === 'empty' ? 'Input is empty.' : result.message;
    throw new Error(message);
  }
  return result.vertices;
}
