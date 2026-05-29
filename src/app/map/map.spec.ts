import { ComponentFixture, TestBed } from '@angular/core/testing';
import * as L from 'leaflet';
import { MapComponent, POLYGON_COORDS } from './map';

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

  it('renders a polygon whose vertices equal the hardcoded constant', () => {
    const ring = component.polygon!.getLatLngs()[0] as L.LatLng[];
    const actual = ring.map((p) => [p.lat, p.lng]);
    const expected = POLYGON_COORDS.map(([lat, lon]) => [lat, lon]);
    expect(actual).toEqual(expected);
  });

  it('renders the polygon as a closed, filled ring', () => {
    expect(component.polygon instanceof L.Polygon).toBeTrue();
    expect(component.polygon!.options.fill).not.toBe(false);
    const path = component.polygon!.getElement() as SVGPathElement;
    const d = path.getAttribute('d') ?? '';
    expect(d.trim().toLowerCase().endsWith('z')).toBeTrue();
  });

  it('fits the map bounds to contain every vertex', () => {
    const bounds = component.map!.getBounds();
    for (const [lat, lon] of POLYGON_COORDS) {
      expect(bounds.contains(L.latLng(lat, lon))).toBeTrue();
    }
  });

  it('logs no console errors during initial render', () => {
    expect(consoleError).not.toHaveBeenCalled();
  });
});
