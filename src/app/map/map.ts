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

/** Styling for standalone coordinate points: discrete red dots. */
const POINT_MARKER_OPTIONS: L.CircleMarkerOptions = {
  radius: 5,
  color: 'red',
  fillColor: 'red',
  fillOpacity: 1,
};

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

  ngAfterViewInit(): void {
    this.map = L.map(this.mapContainer.nativeElement);

    L.tileLayer(OSM_TILE_URL, {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(this.map);

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

    if (this.polygon) {
      this.map.removeLayer(this.polygon);
      this.polygon = undefined;
    }

    const latLngs: L.LatLngTuple[] = vertices.map(({ lat, lon }) => [lat, lon]);
    this.polygon = L.polygon(latLngs).addTo(this.map);
    this.map.fitBounds(this.polygon.getBounds(), { padding: [20, 20] });
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
