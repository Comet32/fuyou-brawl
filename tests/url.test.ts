import { describe, expect, it } from 'vitest';
import { joinBase } from '../src/lib/url';

describe('joinBase', () => {
  it('joins a sub-path base with a leading-slash path', () => {
    expect(joinBase('/fuyou-brawl/', '/heroes/')).toBe('/fuyou-brawl/heroes/');
  });
  it('tolerates a base without trailing slash', () => {
    expect(joinBase('/fuyou-brawl', 'heroes/')).toBe('/fuyou-brawl/heroes/');
  });
  it('maps root path to the base itself', () => {
    expect(joinBase('/fuyou-brawl/', '/')).toBe('/fuyou-brawl/');
    expect(joinBase('/', '/')).toBe('/');
  });
});
