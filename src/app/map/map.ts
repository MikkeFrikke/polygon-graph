import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import * as L from 'leaflet';

/**
 * Hardcoded WGS84 polygon as a flat array of [lat, lon] pairs.
 * This is the Task 01 tracer bullet — it will be replaced by user JSON input in Task 02.
 */
export const POLYGON_COORDS: readonly L.LatLngTuple[] = [
  [47.3769, 8.5417],
  [47.378, 8.545],
  [47.375, 8.546],
];

const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

@Component({
  selector: 'app-map',
  imports: [],
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

  ngAfterViewInit(): void {
    this.map = L.map(this.mapContainer.nativeElement);

    L.tileLayer(OSM_TILE_URL, {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(this.map);

    this.polygon = L.polygon([...POLYGON_COORDS]).addTo(this.map);

    this.map.fitBounds(this.polygon.getBounds(), { padding: [20, 20] });
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }
}
