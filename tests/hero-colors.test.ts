import { describe, expect, it } from 'vitest';
import { findBrokenRefs } from '../src/lib/integrity';
import { heroColorsSchema } from '../src/lib/schema';
import { validSet } from './fixtures';

describe('hero colors', () => {
  it('accepts lowercase #rrggbb per hero id', () => {
    expect(heroColorsSchema.parse({ axe: '#5c403d' })).toEqual({ axe: '#5c403d' });
    expect(() => heroColorsSchema.parse({ axe: 'red' })).toThrow();
    expect(() => heroColorsSchema.parse({ axe: '#5C403D' })).toThrow();
  });
  it('reports colors for unknown heroes', () => {
    const d = { ...validSet(), heroColors: { axe: '#111111', nobody: '#222222' } };
    expect(findBrokenRefs(d)).toEqual(['hero-colors：英雄 "nobody" 不存在']);
  });
});
