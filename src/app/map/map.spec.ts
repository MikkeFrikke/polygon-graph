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

function pointMarkers(component: MapComponent): L.CircleMarker[] {
  return (component.pointsLayer?.getLayers() ?? []).filter(
    (layer): layer is L.CircleMarker => layer instanceof L.CircleMarker,
  );
}

function markerLatLngs(component: MapComponent): [number, number][] {
  return pointMarkers(component).map((m) => [m.getLatLng().lat, m.getLatLng().lng]);
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

  it('keeps the existing polygon and shows an error on invalid input', () => {
    component.jsonInput = '[[10, 20], [10, 30], [15, 25]]';
    component.onInput();

    component.jsonInput = '[[10, 20], ['; // syntactically invalid
    component.onInput();

    expect(component.errorMessage).toContain('Invalid JSON syntax');
    expect(countPolygons(component.map!)).toBe(1);
    expect(ringLatLngs(component)).toEqual([
      [10, 20],
      [10, 30],
      [15, 25],
    ]);
  });

  it('clears the error and renders when switching back to valid input', () => {
    component.jsonInput = 'not json';
    component.onInput();
    expect(component.errorMessage).not.toBe('');

    component.jsonInput = '[[40, 50], [40, 60], [45, 55]]';
    component.onInput();

    expect(component.errorMessage).toBe('');
    expect(ringLatLngs(component)).toEqual([
      [40, 50],
      [40, 60],
      [45, 55],
    ]);
  });

  it('treats empty input as neutral: no error and no exception', () => {
    component.jsonInput = '   ';
    expect(() => component.onInput()).not.toThrow();
    expect(component.errorMessage).toBe('');
  });

  it('does not throw or log console errors for any invalid input', () => {
    const invalidInputs = [
      '[[10, 20], [',
      '{"lat": 1}',
      '[[10, 20], ["x", 9], [10, 11]]',
      '[[100, 20], [10, 30], [15, 25]]',
      '[[10, 200], [10, 30], [15, 25]]',
      '[[10, 20], [10, 30]]',
    ];

    for (const input of invalidInputs) {
      component.jsonInput = input;
      expect(() => component.onInput()).not.toThrow();
      expect(component.errorMessage).not.toBe('');
    }

    expect(consoleError).not.toHaveBeenCalled();
  });

  describe('standalone points', () => {
    it('renders one red CircleMarker per point with matching coordinates', () => {
      component.pointsInput = '[[47, 8], [48, 9]]';
      component.onPointsInput();

      const markers = pointMarkers(component);
      expect(markers.length).toBe(2);
      expect(markerLatLngs(component)).toEqual([
        [47, 8],
        [48, 9],
      ]);
      for (const marker of markers) {
        expect(marker.options.fillColor).toBe('red');
        expect(marker.options.color).toBe('white');
      }
    });

    it('renders the points in a dedicated pane stacked above the polygon', () => {
      component.pointsInput = '[[47, 8], [48, 9]]';
      component.onPointsInput();

      for (const marker of pointMarkers(component)) {
        expect(marker.options.pane).toBe('standalone-points');
      }

      // The points pane sits above both the polygon (overlay pane) and the
      // vertex handles (marker pane), so red points are never hidden.
      const pointsZ = Number(component.map!.getPane('standalone-points')!.style.zIndex);
      const overlayZ = Number(getComputedStyle(component.map!.getPane('overlayPane')!).zIndex);
      const markerZ = Number(getComputedStyle(component.map!.getPane('markerPane')!).zIndex);
      expect(pointsZ).toBeGreaterThan(overlayZ);
      expect(pointsZ).toBeGreaterThan(markerZ);
    });

    it('brings pasted points into view even when they lie outside the polygon', () => {
      // The polygon sits near Zürich; the points are on another continent.
      component.jsonInput = '[[47.37, 8.54], [47.38, 8.55], [47.36, 8.56]]';
      component.onInput();
      component.map!.invalidateSize();

      component.pointsInput = '[[-33.86, 151.2], [-33.87, 151.21]]';
      component.onPointsInput();
      component.map!.invalidateSize();

      const bounds = component.map!.getBounds();
      for (const [lat, lon] of [
        [-33.86, 151.2],
        [-33.87, 151.21],
      ]) {
        expect(bounds.contains(L.latLng(lat, lon))).toBeTrue();
      }
    });

    it('renders points as discrete markers, not as part of the polygon layer', () => {
      component.pointsInput = '[[47, 8], [48, 9]]';
      component.onPointsInput();

      // Markers are CircleMarker instances, never L.Polygon.
      for (const marker of pointMarkers(component)) {
        expect(marker instanceof L.Polygon).toBeFalse();
      }
      // The point coordinates are not part of the polygon's ring.
      expect(ringLatLngs(component)).not.toContain([47, 8]);
    });

    it('updates markers when the points input changes', () => {
      component.pointsInput = '[[47, 8], [48, 9]]';
      component.onPointsInput();
      component.pointsInput = '[[10, 20]]';
      component.onPointsInput();

      expect(markerLatLngs(component)).toEqual([[10, 20]]);
    });

    it('keeps the points layer independent of the polygon layer', () => {
      component.pointsInput = '[[47, 8], [48, 9]]';
      component.onPointsInput();

      const before = markerLatLngs(component);

      // Changing the polygon must not disturb the markers.
      component.jsonInput = '[[40, 50], [40, 60], [45, 55]]';
      component.onInput();
      expect(markerLatLngs(component)).toEqual(before);

      // Changing the points must not disturb the polygon.
      const ringBefore = ringLatLngs(component);
      component.pointsInput = '[[1, 2]]';
      component.onPointsInput();
      expect(ringLatLngs(component)).toEqual(ringBefore);
      expect(countPolygons(component.map!)).toBe(1);
    });

    it('renders no markers for empty/whitespace points input and shows no error', () => {
      component.pointsInput = '[[47, 8]]';
      component.onPointsInput();
      expect(pointMarkers(component).length).toBe(1);

      component.pointsInput = '   ';
      expect(() => component.onPointsInput()).not.toThrow();
      expect(pointMarkers(component).length).toBe(0);
      expect(component.pointsErrorMessage).toBe('');
    });

    it('shows an inline error for invalid points input and leaves markers and polygon unchanged', () => {
      component.pointsInput = '[[47, 8], [48, 9]]';
      component.onPointsInput();
      const markersBefore = markerLatLngs(component);
      const ringBefore = ringLatLngs(component);

      const invalidInputs = ['[[47, 8],', '{"lat": 1}', '[["x", 9]]', '[[100, 8]]'];
      for (const input of invalidInputs) {
        component.pointsInput = input;
        expect(() => component.onPointsInput()).not.toThrow();
        expect(component.pointsErrorMessage).not.toBe('');
        expect(markerLatLngs(component)).toEqual(markersBefore);
        expect(ringLatLngs(component)).toEqual(ringBefore);
      }

      expect(consoleError).not.toHaveBeenCalled();
    });
  });

  describe('vertex editing', () => {
    function vertexHandles(): L.Marker[] {
      return (component.vertexHandlesLayer?.getLayers() ?? []).filter(
        (layer): layer is L.Marker => layer instanceof L.Marker,
      );
    }

    it('places one draggable handle on each polygon vertex', () => {
      component.jsonInput = '[[10, 20], [10, 30], [15, 25]]';
      component.onInput();

      const handles = vertexHandles();
      expect(handles.length).toBe(3);
      expect(handles.map((h) => [h.getLatLng().lat, h.getLatLng().lng])).toEqual([
        [10, 20],
        [10, 30],
        [15, 25],
      ]);
      for (const handle of handles) {
        expect(handle.options.draggable).toBeTrue();
      }
    });

    it('moves the polygon vertex live while a handle is dragged', () => {
      component.jsonInput = '[[10, 20], [10, 30], [15, 25]]';
      component.onInput();

      const handle = vertexHandles()[0];
      handle.setLatLng(L.latLng(12, 22));
      handle.fire('drag');

      expect(ringLatLngs(component)).toEqual([
        [12, 22],
        [10, 30],
        [15, 25],
      ]);
    });

    it('writes the edited ring back into the polygon input when a drag ends', () => {
      component.jsonInput = '[[10, 20], [10, 30], [15, 25]]';
      component.onInput();

      const handle = vertexHandles()[0];
      handle.setLatLng(L.latLng(12.1234567, 22.7654321));
      handle.fire('drag');
      handle.fire('dragend');

      expect(JSON.parse(component.jsonInput)).toEqual([
        [12.123457, 22.765432],
        [10, 30],
        [15, 25],
      ]);
    });

    it('removes the editing handles when drawing starts', () => {
      component.jsonInput = '[[10, 20], [10, 30], [15, 25]]';
      component.onInput();
      expect(vertexHandles().length).toBe(3);

      component.startDrawing();
      expect(component.vertexHandlesLayer).toBeUndefined();
    });

    it('keeps exactly one set of handles after the input changes', () => {
      component.jsonInput = '[[10, 20], [10, 30], [15, 25]]';
      component.onInput();
      component.jsonInput = '[[40, 50], [40, 60], [45, 55], [42, 52]]';
      component.onInput();

      expect(vertexHandles().length).toBe(4);
    });
  });

  describe('adding vertices by double-click', () => {
    function vertexHandles(): L.Marker[] {
      return (component.vertexHandlesLayer?.getLayers() ?? []).filter(
        (layer): layer is L.Marker => layer instanceof L.Marker,
      );
    }

    function dblClick(lat: number, lon: number): MouseEvent {
      const originalEvent = new MouseEvent('dblclick', { cancelable: true });
      component.polygon!.fire('dblclick', { latlng: L.latLng(lat, lon), originalEvent });
      return originalEvent;
    }

    it('inserts a new vertex on the edge nearest the double-click', () => {
      component.jsonInput = '[[10, 20], [10, 30], [15, 25]]';
      component.onInput();
      component.map!.invalidateSize();

      // Midpoint of the first edge [10,20]–[10,30] lies exactly on the line.
      dblClick(10, 25);

      expect(ringLatLngs(component)).toEqual([
        [10, 20],
        [10, 25],
        [10, 30],
        [15, 25],
      ]);
    });

    it('writes the inserted vertex into the polygon textarea', () => {
      component.jsonInput = '[[10, 20], [10, 30], [15, 25]]';
      component.onInput();
      component.map!.invalidateSize();

      dblClick(10, 25);

      expect(JSON.parse(component.jsonInput)).toEqual([
        [10, 20],
        [10, 25],
        [10, 30],
        [15, 25],
      ]);
    });

    it('places a draggable handle on the inserted vertex', () => {
      component.jsonInput = '[[10, 20], [10, 30], [15, 25]]';
      component.onInput();
      component.map!.invalidateSize();
      expect(vertexHandles().length).toBe(3);

      dblClick(10, 25);

      expect(vertexHandles().length).toBe(4);
    });

    it('ignores a double-click that is not near any edge', () => {
      component.jsonInput = '[[10, 20], [10, 40], [40, 40], [40, 20]]';
      component.onInput();
      component.map!.invalidateSize();
      const before = ringLatLngs(component);

      // Centre of the square, far from every edge in screen space.
      dblClick(25, 30);

      expect(ringLatLngs(component)).toEqual(before);
    });
  });

  describe('interactive drawing', () => {
    function leftClick(lat: number, lon: number): void {
      component.map!.fire('click', { latlng: L.latLng(lat, lon) });
    }

    function rightClick(lat: number, lon: number): MouseEvent {
      const originalEvent = new MouseEvent('contextmenu', { cancelable: true });
      component.map!.fire('contextmenu', { latlng: L.latLng(lat, lon), originalEvent });
      return originalEvent;
    }

    function draftMarkers(): L.CircleMarker[] {
      return (component.drawLayer?.getLayers() ?? []).filter(
        (layer): layer is L.CircleMarker => layer instanceof L.CircleMarker,
      );
    }

    it('ignores map clicks until drawing is started', () => {
      leftClick(10, 20);
      expect(component.drawnVertices).toEqual([]);
      expect(draftMarkers().length).toBe(0);
    });

    it('adds a vertex and a preview marker per left click while drawing', () => {
      component.startDrawing();
      leftClick(10, 20);
      leftClick(11, 21);

      expect(component.drawnVertices).toEqual([
        { lat: 10, lon: 20 },
        { lat: 11, lon: 21 },
      ]);
      expect(draftMarkers().length).toBe(2);
    });

    it('clears the displayed polygon when drawing starts', () => {
      expect(countPolygons(component.map!)).toBe(1);
      component.startDrawing();
      expect(countPolygons(component.map!)).toBe(0);
    });

    it('closes the polygon on right click and renders the drawn ring', () => {
      component.startDrawing();
      leftClick(10, 20);
      leftClick(10, 30);
      leftClick(15, 25);
      const originalEvent = rightClick(15, 25);

      expect(originalEvent.defaultPrevented).toBeTrue();
      expect(component.isDrawing).toBeFalse();
      expect(component.drawLayer).toBeUndefined();
      expect(countPolygons(component.map!)).toBe(1);
      expect(ringLatLngs(component)).toEqual([
        [10, 20],
        [10, 30],
        [15, 25],
      ]);
    });

    it('writes the drawn coordinates into the polygon textarea, updated per click', () => {
      component.startDrawing();
      expect(component.jsonInput).toBe('');

      leftClick(10, 20);
      leftClick(11, 21);

      expect(JSON.parse(component.jsonInput)).toEqual([
        [10, 20],
        [11, 21],
      ]);
    });

    it('keeps the drawn coordinates in the textarea after the polygon is closed', () => {
      component.startDrawing();
      leftClick(10, 20);
      leftClick(10, 30);
      leftClick(15, 25);
      rightClick(15, 25);

      expect(JSON.parse(component.jsonInput)).toEqual([
        [10, 20],
        [10, 30],
        [15, 25],
      ]);
    });

    it('restores the previous textarea content when drawing is cancelled', () => {
      const before = component.jsonInput;
      component.startDrawing();
      leftClick(10, 20);
      expect(component.jsonInput).not.toBe(before);

      component.cancelDrawing();
      expect(component.jsonInput).toBe(before);
    });

    it('keeps drawing on right click with fewer than three vertices', () => {
      component.startDrawing();
      leftClick(10, 20);
      leftClick(10, 30);
      rightClick(10, 30);

      expect(component.isDrawing).toBeTrue();
      expect(component.drawnVertices.length).toBe(2);
      expect(countPolygons(component.map!)).toBe(0);
    });

    it('discards the in-progress draft when drawing is cancelled', () => {
      component.startDrawing();
      leftClick(10, 20);
      leftClick(11, 21);
      component.cancelDrawing();

      expect(component.isDrawing).toBeFalse();
      expect(component.drawnVertices).toEqual([]);
      expect(component.drawLayer).toBeUndefined();
    });

    it('rounds clicked coordinates to six decimals', () => {
      component.startDrawing();
      leftClick(10.123456789, 20.987654321);

      expect(component.drawnVertices).toEqual([{ lat: 10.123457, lon: 20.987654 }]);
    });
  });
});
