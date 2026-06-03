import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { PolygonVertex, validatePoints, validatePolygon } from '../polygon';

/**
 * Example WGS84 polygon as a flat array of [lat, lon] pairs.
 * This is the initial textarea content and the single source for the first render.
 */
export const EXAMPLE_JSON = `[
  [47.3769, 8.5417],
  [47.3780, 8.5450],
  [47.3750, 8.5460]
]`;

const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

/** Styling for standalone coordinate points: discrete red dots with a white outline. */
const POINT_MARKER_OPTIONS: L.CircleMarkerOptions = {
  radius: 7,
  color: 'white',
  weight: 2,
  fillColor: 'red',
  fillOpacity: 1,
};

/** Styling for the vertices placed while drawing a polygon interactively. */
const DRAFT_MARKER_OPTIONS: L.CircleMarkerOptions = {
  radius: 4,
  color: '#1565c0',
  fillColor: '#1565c0',
  fillOpacity: 1,
};

/** Styling for the connecting line shown while a polygon is being drawn. */
const DRAFT_LINE_OPTIONS: L.PolylineOptions = {
  color: '#1565c0',
  weight: 2,
  dashArray: '4 4',
};

/**
 * The draggable handle placed on each vertex of the rendered polygon. A small
 * square div icon centred on the vertex; styled in map.css as `.vertex-handle`.
 */
const VERTEX_HANDLE_ICON: L.DivIcon = L.divIcon({
  className: 'vertex-handle',
  iconSize: [14, 14],
});

/** A polygon ring needs at least this many vertices to enclose an area. */
const MIN_VERTICES = 3;

/** Decimal places kept for coordinates captured from mouse clicks. */
const CLICK_PRECISION = 6;

/**
 * How close, in screen pixels, a double-click must be to a polygon edge to
 * count as "on the line" and insert a new vertex there. Double-clicks farther
 * than this (e.g. in the filled interior) are ignored.
 */
const EDGE_HIT_TOLERANCE_PX = 10;

@Component({
  selector: 'app-map',
  imports: [FormsModule],
  templateUrl: './map.html',
  styleUrl: './map.css',
})
export class MapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true })
  private readonly mapContainer!: ElementRef<HTMLDivElement>;

  /** The Leaflet map instance. Exposed so tests can assert on layers and bounds. */
  map?: L.Map;

  /** The rendered polygon layer. Exposed so tests can assert on its vertices. */
  polygon?: L.Polygon;

  /**
   * The vertices of the rendered polygon, kept as the source of truth while the
   * user drags handles. Updated live on drag and serialised back into
   * {@link jsonInput} when a drag ends.
   */
  polygonVertices: PolygonVertex[] = [];

  /**
   * Layer holding one draggable handle per polygon vertex, so a rendered
   * polygon can be edited by grabbing a point and moving it. Exposed so tests
   * can assert on the handles.
   */
  vertexHandlesLayer?: L.LayerGroup;

  /**
   * The layer holding the standalone red point markers. Independent of the
   * polygon layer. Exposed so tests can assert on the markers it contains.
   */
  pointsLayer?: L.LayerGroup;

  /** Raw JSON text from the polygon input, pre-filled with a valid example. */
  jsonInput = EXAMPLE_JSON;

  /** Raw JSON text from the standalone points input; empty by default. */
  pointsInput = '';

  /** Inline validation feedback for the polygon input; empty string means no error. */
  errorMessage = '';

  /** Inline validation feedback for the points input; empty string means no error. */
  pointsErrorMessage = '';

  /** Whether interactive polygon drawing is currently active. */
  isDrawing = false;

  /**
   * Vertices collected during the current draw session, in click order.
   * Exposed so tests can assert on the in-progress drawing.
   */
  drawnVertices: PolygonVertex[] = [];

  /**
   * Preview layer for the in-progress drawing: a dot per clicked vertex plus a
   * dashed line connecting them. Exposed so tests can assert on its contents.
   */
  drawLayer?: L.LayerGroup;

  /**
   * The polygon input text as it was when the current draw session started, so
   * a cancelled drawing can restore the textarea (and the rendered polygon) to
   * its previous state. Empty when no draw session is active.
   */
  private jsonBeforeDrawing = '';

  ngAfterViewInit(): void {
    this.map = L.map(this.mapContainer.nativeElement);

    L.tileLayer(OSM_TILE_URL, {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(this.map);

    // Left click adds a vertex while drawing; right click closes the polygon.
    this.map.on('click', (e) => this.onMapClick(e));
    this.map.on('contextmenu', (e) => this.onMapRightClick(e));

    // The example JSON is the single source for the initial render.
    this.onInput();
    // Render any initial standalone points (empty by default → no markers).
    this.onPointsInput();
  }

  /**
   * Validate the current input and render it, replacing any prior polygon.
   *
   * On invalid input the existing map stays stable and an inline error is
   * shown. Empty input is a neutral state: the error clears and the map is
   * left untouched. Valid input clears the error and renders.
   */
  onInput(): void {
    const result = validatePolygon(this.jsonInput);

    if (result.kind === 'empty') {
      this.errorMessage = '';
      return;
    }

    if (result.kind === 'error') {
      this.errorMessage = result.message;
      return;
    }

    this.errorMessage = '';
    this.renderPolygon(result.vertices);
  }

  private renderPolygon(vertices: PolygonVertex[]): void {
    if (!this.map) {
      return;
    }

    this.removePolygon();

    this.polygonVertices = vertices.map((v) => ({ ...v }));
    const latLngs: L.LatLngTuple[] = this.polygonVertices.map(({ lat, lon }) => [lat, lon]);
    this.polygon = L.polygon(latLngs).addTo(this.map);
    this.polygon.on('dblclick', (e) => this.onPolygonDblClick(e));
    this.map.fitBounds(this.polygon.getBounds(), { padding: [20, 20] });

    this.renderVertexHandles();
  }

  /** Remove the rendered polygon and its editing handles from the map. */
  private removePolygon(): void {
    if (this.map && this.polygon) {
      this.map.removeLayer(this.polygon);
    }
    this.polygon = undefined;
    this.clearVertexHandles();
    this.polygonVertices = [];
  }

  /**
   * Place a draggable handle on every vertex of the rendered polygon. Dragging
   * a handle moves that vertex live; releasing it writes the new coordinates
   * back into the polygon input textarea.
   */
  private renderVertexHandles(): void {
    this.clearVertexHandles();
    if (!this.map || !this.polygon) {
      return;
    }

    const handles = this.polygonVertices.map(({ lat, lon }, index) => {
      const handle = L.marker([lat, lon], {
        icon: VERTEX_HANDLE_ICON,
        draggable: true,
        keyboard: false,
      });
      handle.on('drag', () => this.onVertexDrag(index, handle.getLatLng()));
      handle.on('dragend', () => this.onVertexDragEnd());
      return handle;
    });

    this.vertexHandlesLayer = L.layerGroup(handles).addTo(this.map);
  }

  private clearVertexHandles(): void {
    if (this.map && this.vertexHandlesLayer) {
      this.map.removeLayer(this.vertexHandlesLayer);
    }
    this.vertexHandlesLayer = undefined;
  }

  /**
   * Move a single polygon vertex to a new position while its handle is being
   * dragged, keeping the filled polygon in sync in real time.
   */
  private onVertexDrag(index: number, latlng: L.LatLng): void {
    const vertex = this.polygonVertices[index];
    if (!vertex || !this.polygon) {
      return;
    }

    vertex.lat = latlng.lat;
    vertex.lon = latlng.lng;
    this.polygon.setLatLngs(this.polygonVertices.map(({ lat, lon }) => [lat, lon]));
  }

  /**
   * After a vertex drag finishes, round the moved coordinates and write the
   * edited ring back into the polygon input textarea so it reflects the edit
   * and stays the single source of truth. The view is left as-is (no refit) so
   * the map does not jump while editing.
   */
  private onVertexDragEnd(): void {
    this.polygonVertices = this.polygonVertices.map(({ lat, lon }) => ({
      lat: Number(lat.toFixed(CLICK_PRECISION)),
      lon: Number(lon.toFixed(CLICK_PRECISION)),
    }));
    this.errorMessage = '';
    this.jsonInput = this.verticesToJson(this.polygonVertices);
  }

  /**
   * Insert a new vertex where the user double-clicks on a polygon edge. The
   * nearest edge is found in screen space; if the click is within
   * {@link EDGE_HIT_TOLERANCE_PX} of that edge the click counts as "on the
   * line" and a vertex is spliced in between the edge's endpoints. Double-clicks
   * in the filled interior are too far from any edge and are ignored.
   *
   * The new ring is written back into the textarea and the handles are
   * refreshed; the view is left as-is so the map does not jump.
   */
  private onPolygonDblClick(e: L.LeafletMouseEvent): void {
    if (!this.map || !this.polygon || this.polygonVertices.length < 2) {
      return;
    }

    const clickPoint = this.map.latLngToContainerPoint(e.latlng);
    const points = this.polygonVertices.map(({ lat, lon }) =>
      this.map!.latLngToContainerPoint([lat, lon]),
    );

    let bestEdge = -1;
    let bestDistance = Infinity;
    for (let i = 0; i < points.length; i++) {
      const next = (i + 1) % points.length;
      const distance = L.LineUtil.pointToSegmentDistance(clickPoint, points[i], points[next]);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestEdge = i;
      }
    }

    if (bestEdge < 0 || bestDistance > EDGE_HIT_TOLERANCE_PX) {
      return;
    }

    // Keep the double-click from also zooming the map.
    if (e.originalEvent) {
      L.DomEvent.stop(e.originalEvent);
    }

    const newVertex: PolygonVertex = {
      lat: Number(e.latlng.lat.toFixed(CLICK_PRECISION)),
      lon: Number(e.latlng.lng.toFixed(CLICK_PRECISION)),
    };
    this.polygonVertices.splice(bestEdge + 1, 0, newVertex);
    this.polygon.setLatLngs(this.polygonVertices.map(({ lat, lon }) => [lat, lon]));
    this.errorMessage = '';
    this.jsonInput = this.verticesToJson(this.polygonVertices);
    this.renderVertexHandles();
  }

  /**
   * Enter interactive drawing mode: start a fresh, empty draft and remove the
   * currently displayed polygon so the new one can be drawn on a clean canvas.
   * Each subsequent left click adds a vertex; a right click closes the polygon.
   */
  startDrawing(): void {
    this.isDrawing = true;
    this.drawnVertices = [];
    this.errorMessage = '';

    // Remember the current input so a cancel can restore it, then clear the
    // single textarea so it can show the polygon as it is drawn.
    this.jsonBeforeDrawing = this.jsonInput;
    this.jsonInput = '';

    this.removePolygon();

    this.renderDraft();
  }

  /**
   * Leave drawing mode and discard the in-progress draft. The textarea and the
   * rendered polygon are restored to whatever they showed before drawing began.
   */
  cancelDrawing(): void {
    this.isDrawing = false;
    this.drawnVertices = [];
    this.clearDraft();

    this.jsonInput = this.jsonBeforeDrawing;
    this.onInput();
  }

  /**
   * Finish the current drawing on right click: a polygon needs at least three
   * vertices, so with fewer the click is ignored and drawing continues. With
   * enough vertices the drawn ring is rendered on the map; the textarea keeps
   * the drawn coordinates that were written there live during drawing.
   */
  finishDrawing(): void {
    if (!this.isDrawing || this.drawnVertices.length < MIN_VERTICES) {
      return;
    }

    this.isDrawing = false;
    this.errorMessage = '';
    this.clearDraft();
    this.renderPolygon(this.drawnVertices);
    this.drawnVertices = [];
  }

  private onMapClick(e: L.LeafletMouseEvent): void {
    if (!this.isDrawing) {
      return;
    }

    this.drawnVertices.push({
      lat: Number(e.latlng.lat.toFixed(CLICK_PRECISION)),
      lon: Number(e.latlng.lng.toFixed(CLICK_PRECISION)),
    });
    this.jsonInput = this.verticesToJson(this.drawnVertices);
    this.renderDraft();
  }

  private onMapRightClick(e: L.LeafletMouseEvent): void {
    if (!this.isDrawing) {
      return;
    }

    // Suppress the browser context menu so the right click only closes the polygon.
    L.DomEvent.preventDefault(e.originalEvent);
    this.finishDrawing();
  }

  private renderDraft(): void {
    this.clearDraft();
    if (!this.map) {
      return;
    }

    const latLngs: L.LatLngTuple[] = this.drawnVertices.map(({ lat, lon }) => [lat, lon]);
    const layers: L.Layer[] = latLngs.map((ll) => L.circleMarker(ll, DRAFT_MARKER_OPTIONS));
    if (latLngs.length >= 2) {
      layers.push(L.polyline(latLngs, DRAFT_LINE_OPTIONS));
    }

    this.drawLayer = L.layerGroup(layers).addTo(this.map);
  }

  private clearDraft(): void {
    if (this.map && this.drawLayer) {
      this.map.removeLayer(this.drawLayer);
    }
    this.drawLayer = undefined;
  }

  /** Serialise vertices into the flat `[lat, lon]` JSON the textarea expects. */
  private verticesToJson(vertices: PolygonVertex[]): string {
    const rows = vertices.map(({ lat, lon }) => `  [${lat}, ${lon}]`);
    return `[\n${rows.join(',\n')}\n]`;
  }

  /**
   * Validate the standalone points input and render it as red markers,
   * independently of the polygon.
   *
   * Empty input is a neutral state: the error clears and any existing markers
   * are removed. On invalid input the existing markers and polygon stay stable
   * and an inline error is shown. Valid input clears the error and renders the
   * markers (a well-formed empty array renders no markers).
   */
  onPointsInput(): void {
    const result = validatePoints(this.pointsInput);

    if (result.kind === 'empty') {
      this.pointsErrorMessage = '';
      this.renderPoints([]);
      return;
    }

    if (result.kind === 'error') {
      this.pointsErrorMessage = result.message;
      return;
    }

    this.pointsErrorMessage = '';
    this.renderPoints(result.vertices);
  }

  private renderPoints(vertices: PolygonVertex[]): void {
    if (!this.map) {
      return;
    }

    if (this.pointsLayer) {
      this.map.removeLayer(this.pointsLayer);
      this.pointsLayer = undefined;
    }

    const markers = vertices.map(({ lat, lon }) =>
      L.circleMarker([lat, lon], POINT_MARKER_OPTIONS),
    );
    this.pointsLayer = L.layerGroup(markers).addTo(this.map);
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }
}
