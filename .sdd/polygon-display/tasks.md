# Tasks — Polygon Display App

Derived from `polygon-requirements.md`. An Angular app that displays an arbitrary WGS84 polygon, driven by a JSON coordinate list entered by the user.

**Locked decisions**
- Coordinate JSON format: a flat array of `[lat, lon]` pairs in WGS84, e.g. `[[47.3769, 8.5417], [47.3780, 8.5450], [47.3750, 8.5460]]`.
- Ring closure: the app auto-closes the polygon; the user does **not** need to repeat the first point.
- Map rendering: Leaflet with OpenStreetMap tiles (no API key).

**Out of scope** (defer): self-intersecting polygons, antimeridian crossing, holes/multi-polygons, deduplication of consecutive points.

---

## Task 01-render-static-polygon-on-map

Bootstrap the Angular application and integrate Leaflet with OpenStreetMap tiles. On load, the app shows a slippy map and draws a single **hardcoded** WGS84 polygon (a constant `[lat, lon]` array) as a closed, filled overlay, with the viewport fit to the polygon's bounds. This is the tracer bullet: it cuts through bootstrap → component → map library → rendered polygon → viewport, proving the entire display pipeline before any input exists.

### Implementation steps

- [x] Initialize the Angular app with the CLI and confirm it builds and serves.
- [x] Add Leaflet as a dependency and wire its CSS/assets into the build.
- [x] Create a map component that instantiates a Leaflet map with an OSM tile layer.
- [x] Define a hardcoded `[lat, lon]` polygon constant and render it as a closed filled Leaflet polygon.
- [x] Fit the map view to the polygon's bounds on initial load.

### Acceptance criteria

- [x] `ng serve` starts the app and the root route shows a map with a visible OSM tile layer (a `.leaflet-tile` element / tile layer is present in the map).
- [x] A polygon overlay is rendered whose vertex coordinates equal the hardcoded constant (assertable via the layer's LatLngs).
- [x] The polygon renders as a closed ring (first and last vertex coincide) with a fill.
- [x] After load, `map.getBounds()` contains every vertex of the hardcoded polygon.

### Quality gates

- [x] `ng build` (production configuration) completes with no errors.
- [x] `ng lint` passes with no errors or warnings.
- [x] No errors logged to the browser console on initial load.

---

## Task 02-render-polygon-from-json-input

Add a textarea where the user pastes a JSON array of `[lat, lon]` pairs. On input change, the app parses the JSON, converts it to a polygon, and renders it on the map — replacing the previously displayed polygon and re-fitting the viewport to the new bounds. This replaces the hardcoded polygon from Task 01 as the source of truth, completing the input → parse → render → refit path. The textarea ships with a working example as placeholder/initial text so the default state shows a real polygon.

### Implementation steps

- [x] Add a textarea bound to a model field, pre-filled with a valid example `[lat, lon]` JSON array.
- [x] Implement a parse function: JSON string → array of `{lat, lon}` vertices (the documented `[lat, lon]` schema).
- [x] On input change, parse and feed the resulting vertices to the map, removing the prior polygon layer.
- [x] Re-fit the map bounds to the newly rendered polygon.
- [x] Make the example JSON the single source for the initial render (no hardcoded constant remains in the render path).

### Acceptance criteria

- [x] Entering a valid `[lat, lon]` JSON array renders the matching polygon; its vertices equal the parsed input.
- [x] Editing the input to a different valid array replaces the old polygon (only one polygon layer remains on the map).
- [x] After a successful render, `map.getBounds()` contains all vertices of the new polygon.
- [x] On initial load, the example JSON in the textarea is rendered as a polygon (default non-empty state).

### Quality gates

- [x] `ng build` (production) and `ng lint` both pass with no errors/warnings.
- [x] A unit test covers the parse function for a valid `[lat, lon]` input and asserts the resulting vertices.

---

## Task 03-input-validation-and-error-feedback

Harden the input so malformed entries never crash the app and always produce clear, inline feedback. Invalid JSON syntax, coordinates outside WGS84 ranges (lat ∈ [-90, 90], lon ∈ [-180, 180]), fewer than 3 vertices, and structurally wrong input (not an array of two-number pairs) each yield a specific error message. While input is invalid, the map stays stable; when input becomes valid again, the error clears and the polygon renders. Empty input is treated as a neutral state, not an error.

### Implementation steps

- [x] Validate JSON syntax and surface a parse/syntax error message.
- [x] Validate structure: top level is an array of `[number, number]` pairs.
- [x] Validate coordinate ranges (lat ∈ [-90, 90], lon ∈ [-180, 180]) and minimum of 3 vertices.
- [x] Render a single inline error message area reflecting the first failing rule; clear it on valid input.
- [x] Handle empty/whitespace-only input as a neutral state (clear errors; clear or leave the map without throwing).

### Acceptance criteria

- [x] Syntactically invalid JSON shows a syntax error and does not throw or alter the existing valid polygon.
- [x] A coordinate outside WGS84 range shows a range error naming the offending bound.
- [x] Input with fewer than 3 vertices shows a "minimum 3 points" error.
- [x] Structurally wrong input (e.g. not pairs of numbers) shows a structure error.
- [x] Switching from invalid to valid input clears the error and renders the polygon.
- [x] Empty input produces no error and no unhandled exception.

### Quality gates

- [x] `ng build` (production) and `ng lint` both pass with no errors/warnings.
- [x] Unit tests cover each validation branch (syntax, structure, range, min-points, empty).
- [x] No unhandled exceptions reach the console for any invalid input case.

---

## Task 04-add-standalone-coordinate-points

Let the user place **standalone coordinate points** that are independent of the polygon. A second textarea accepts a JSON array of `[lat, lon]` pairs (same documented schema as the polygon), and each point is rendered on the map as a **red dot**. These points are not vertices of the polygon: they do not connect, close, or fill — they are a separate marker overlay. The polygon and the points are driven by two independent inputs and rendered as two independent layers; editing one never disturbs the other.

### Implementation steps

- [ ] Add a second textarea bound to its own model field for the standalone points JSON (`[lat, lon]` array), separate from the polygon input.
- [ ] Reuse the existing `[lat, lon]` parsing/validation, but require a minimum of 0 points (an empty array / empty input is valid and renders no markers — there is no 3-point minimum for standalone points).
- [ ] On points-input change, render each vertex as a red point marker (e.g. a Leaflet `circleMarker` styled red), in a dedicated marker layer.
- [ ] Replace the previous marker layer on each change so only the current set of points is shown; removing a point removes its marker.
- [ ] Show inline validation feedback for the points input (syntax, structure, range) in its own error area, independent of the polygon's error area.

### Acceptance criteria

- [ ] Entering a valid `[lat, lon]` JSON array of points renders one red marker per point; the markers' coordinates equal the parsed input.
- [ ] The points are rendered as discrete dots — they are not connected into a line or polygon and have no fill ring (assertable: the markers are `CircleMarker`/marker instances, not part of the polygon layer's LatLngs).
- [ ] Each point marker is styled red (its stroke/fill color resolves to red).
- [ ] Editing the points input updates the markers (adding, removing, or moving points) without altering the polygon layer.
- [ ] Editing the polygon input does not add, remove, or move any point markers.
- [ ] Empty/whitespace points input produces no markers, no error, and no unhandled exception.
- [ ] Invalid points input (bad syntax, wrong structure, out-of-range coordinate) shows an inline error and leaves the existing markers and the polygon unchanged.

### Quality gates

- [ ] `ng build` (production) and `ng lint` both pass with no errors/warnings.
- [ ] Unit tests cover: valid points render as red markers, points layer is independent of the polygon layer, and empty/invalid points input.
- [ ] No unhandled exceptions reach the console for any points-input case.
