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

import { blessingColorsSchema } from '../src/lib/schema';

describe('blessing icon colors', () => {
  it('accepts icon names with #rrggbb', () => {
    expect(blessingColorsSchema.parse({ '10004a': '#a0704c' })).toEqual({ '10004a': '#a0704c' });
    expect(() => blessingColorsSchema.parse({ 'a/b': '#a0704c' })).toThrow();
    expect(() => blessingColorsSchema.parse({ '10001': '#FFF' })).toThrow();
  });
  it('reports colors for icons no blessing uses', () => {
    const d = { ...validSet(), blessingColors: { ghost: '#111111' } };
    expect(findBrokenRefs(d)).toEqual(['blessing-colors：没有福佑使用图标 "ghost"']);
  });
});
