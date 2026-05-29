import { parsePolygon } from './polygon';

describe('parsePolygon', () => {
  it('parses a valid [lat, lon] JSON array into vertices', () => {
    const json = '[[47.3769, 8.5417], [47.3780, 8.5450], [47.3750, 8.5460]]';

    const vertices = parsePolygon(json);

    expect(vertices).toEqual([
      { lat: 47.3769, lon: 8.5417 },
      { lat: 47.378, lon: 8.545 },
      { lat: 47.375, lon: 8.546 },
    ]);
  });
});
