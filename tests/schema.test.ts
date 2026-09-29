import { describe, expect, it } from 'vitest';
import { blessingSchema } from '../src/lib/schema';

const base = { id: 'x', name: '甲', category: '其他', effect: '效果' };
const withIcon = (icon: string) => blessingSchema.safeParse({ ...base, icon }).success;

describe('blessingSchema icon', () => {
  it('accepts a plain webp/png file name', () => {
    expect(withIcon('a-b.webp')).toBe(true);
    expect(withIcon('a_b.1.png')).toBe(true);
  });
  it('rejects path traversal and other extensions', () => {
    expect(withIcon('../x.webp')).toBe(false);
    expect(withIcon('dir/x.webp')).toBe(false);
    expect(withIcon('x.svg')).toBe(false);
  });
  it('is optional', () => {
    expect(blessingSchema.safeParse(base).success).toBe(true);
  });
});
