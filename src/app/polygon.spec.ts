import { parsePolygon, validatePolygon } from './polygon';

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

describe('validatePolygon', () => {
  it('returns valid vertices for a well-formed [lat, lon] array', () => {
    const result = validatePolygon('[[47.3769, 8.5417], [47.3780, 8.5450], [47.3750, 8.5460]]');

    expect(result).toEqual({
      kind: 'valid',
      vertices: [
        { lat: 47.3769, lon: 8.5417 },
        { lat: 47.378, lon: 8.545 },
        { lat: 47.375, lon: 8.546 },
      ],
    });
  });

  it('reports a syntax error for malformed JSON', () => {
    const result = validatePolygon('[[47.3769, 8.5417],');

    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.message).toContain('Invalid JSON syntax');
    }
  });

  it('reports a structure error when the top level is not an array', () => {
    const result = validatePolygon('{"lat": 47, "lon": 8}');

    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.message).toContain('array of [lat, lon] pairs');
    }
  });

  it('reports a structure error when entries are not pairs of numbers', () => {
    const result = validatePolygon('[[47, 8], ["x", 9], [10, 11]]');

    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.message).toContain('[lat, lon] pair of two numbers');
    }
  });

  it('reports a range error naming the offending latitude bound', () => {
    const result = validatePolygon('[[100, 8], [47, 9], [48, 10]]');

    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.message).toContain('Latitude');
      expect(result.message).toContain('[-90, 90]');
    }
  });

  it('reports a range error naming the offending longitude bound', () => {
    const result = validatePolygon('[[47, 200], [47, 9], [48, 10]]');

    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.message).toContain('Longitude');
      expect(result.message).toContain('[-180, 180]');
    }
  });

  it('reports a minimum-points error for fewer than 3 vertices', () => {
    const result = validatePolygon('[[47, 8], [48, 9]]');

    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.message).toContain('at least 3 points');
    }
  });

  it('treats empty input as a neutral (non-error) state', () => {
    expect(validatePolygon('')).toEqual({ kind: 'empty' });
    expect(validatePolygon('   \n  ')).toEqual({ kind: 'empty' });
  });
});
