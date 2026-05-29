import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { PolygonVertex, validatePolygon } from '../polygon';

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

  /** Raw JSON text from the input, pre-filled with a valid example. */
  jsonInput = EXAMPLE_JSON;

  /** Inline validation feedback; empty string means no error. */
  errorMessage = '';

  ngAfterViewInit(): void {
    this.map = L.map(this.mapContainer.nativeElement);

    L.tileLayer(OSM_TILE_URL, {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(this.map);

    // The example JSON is the single source for the initial render.
    this.onInput();
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

  ngOnDestroy(): void {
    this.map?.remove();
  }
}
