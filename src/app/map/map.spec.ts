import { ComponentFixture, TestBed } from '@angular/core/testing';
import * as L from 'leaflet';
import { parsePolygon } from '../polygon';
import { EXAMPLE_JSON, MapComponent } from './map';

function ringLatLngs(component: MapComponent): [number, number][] {
  const ring = component.polygon!.getLatLngs()[0] as L.LatLng[];
  return ring.map((p) => [p.lat, p.lng]);
}

function countPolygons(map: L.Map): number {
  let count = 0;
  map.eachLayer((layer) => {
    if (layer instanceof L.Polygon) {
      count += 1;
    }
  });
  return count;
}

describe('MapComponent', () => {
  let fixture: ComponentFixture<MapComponent>;
  let component: MapComponent;
  let consoleError: jasmine.Spy;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MapComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MapComponent);
    component = fixture.componentInstance;

    // Attach to the DOM with a real size so Leaflet can compute pixel bounds.
    const host = fixture.nativeElement as HTMLElement;
    host.style.display = 'block';
    host.style.width = '800px';
    host.style.height = '600px';
    document.body.appendChild(host);

    consoleError = spyOn(console, 'error').and.callThrough();

    fixture.detectChanges(); // triggers ngAfterViewInit
    component.map?.invalidateSize();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('adds an OpenStreetMap tile layer to the map', () => {
    let tileLayer: L.TileLayer | undefined;
    component.map!.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        tileLayer = layer;
      }
    });
    expect(tileLayer).toBeDefined();
    const url = (tileLayer as unknown as { _url: string })._url;
    expect(url).toContain('openstreetmap.org');
  });

  it('renders the example JSON as a polygon on initial load', () => {
    const expected: [number, number][] = parsePolygon(EXAMPLE_JSON).map(({ lat, lon }) => [
      lat,
      lon,
    ]);
    expect(ringLatLngs(component)).toEqual(expected);
  });

  it('renders a polygon whose vertices equal the parsed input', () => {
    component.jsonInput = '[[10, 20], [10, 30], [15, 25]]';
    component.onInput();

    expect(ringLatLngs(component)).toEqual([
      [10, 20],
      [10, 30],
      [15, 25],
    ]);
  });

  it('replaces the old polygon when the input changes, leaving only one', () => {
    component.jsonInput = '[[10, 20], [10, 30], [15, 25]]';
    component.onInput();
    component.jsonInput = '[[40, 50], [40, 60], [45, 55]]';
    component.onInput();

    expect(countPolygons(component.map!)).toBe(1);
    expect(ringLatLngs(component)).toEqual([
      [40, 50],
      [40, 60],
      [45, 55],
    ]);
  });

  it('renders the polygon as a closed, filled ring', () => {
    expect(component.polygon instanceof L.Polygon).toBeTrue();
    expect(component.polygon!.options.fill).not.toBe(false);
    const path = component.polygon!.getElement() as SVGPathElement;
    const d = path.getAttribute('d') ?? '';
    expect(d.trim().toLowerCase().endsWith('z')).toBeTrue();
  });

  it('fits the map bounds to contain every vertex of the rendered polygon', () => {
    component.jsonInput = '[[40, 50], [40, 60], [45, 55]]';
    component.onInput();
    component.map!.invalidateSize();

    const bounds = component.map!.getBounds();
    for (const [lat, lon] of [
      [40, 50],
      [40, 60],
      [45, 55],
    ]) {
      expect(bounds.contains(L.latLng(lat, lon))).toBeTrue();
    }
  });

  it('logs no console errors during initial render', () => {
    expect(consoleError).not.toHaveBeenCalled();
  });
});
