import { describe, expect, it } from 'vitest';
import {
  convertNote,
  isPossiblyOutdated,
  normalizeTipDate,
  sourceLink,
  type ResearchNote,
} from '../src/lib/community';
import { blessingCommunitySchema } from '../src/lib/schema';

const WIKI = 'http://122.51.0.76:8081/api/universal';
const GUIDE = 'http://122.51.0.76:8081/icons/guides/1.png';
const CHANGELOG = 'https://steamcommunity.com/sharedfiles/filedetails/changelog/2841152696?l=schinese';
const BILI = 'https://www.bilibili.com/video/BV1feAHzJEGH/';

const ctx = {
  heroIdByName: new Map([
    ['斧王', 'axe'],
    ['自然先知', 'furion'],
  ]),
  placeholders: new Set(['gold', 'range', 'pct']),
};

const note = (extra: Partial<ResearchNote> = {}): ResearchNote => ({ id: '10010', name: '电锤思维', ...extra });

describe('convertNote', () => {
  it('returns no entry for a note without usable data', () => {
    expect(convertNote(note(), ctx).entry).toBeUndefined();
  });

  it('takes quality with its source', () => {
    const { entry } = convertNote(note({ quality: { value: 'ssr', source: WIKI, date: '2026-09-29' } }), ctx);
    expect(entry).toEqual({ quality: 'ssr', quality_source: WIKI });
  });

  it('skips quality when sources conflict and records a note tip instead', () => {
    const { entry, skipped } = convertNote(
      note({
        quality: { value: 'sr', source: WIKI, date: '2026-09-29' },
        quality_conflicts: [{ value: 'r', source: 'http://122.51.0.76:8081/api/hero-guides', note: 'x' }],
      }),
      ctx,
    );
    expect(entry?.quality).toBeUndefined();
    expect(entry?.tips).toEqual([
      { text: '品质说法不一：社区图鉴为紫色，社区一图流为蓝色，暂不标注', source: WIKI, date: '2026-09-29' },
    ]);
    expect(skipped).toEqual([{ id: '10010', what: 'quality', reason: 'quality_conflict' }]);
  });

  it('keeps quality_note as notes', () => {
    const { entry } = convertNote(note({ quality: null, quality_note: '同名条目多种颜色' }), ctx);
    expect(entry).toEqual({ notes: '同名条目多种颜色' });
  });

  it('turns values into numbers and ranges into "a~b" strings, recording sources', () => {
    const { entry } = convertNote(
      note({
        numbers: {
          gold: { value: 3500, source: CHANGELOG },
          range: { range: [200, 400], sample: 266.32, source: WIKI },
        },
      }),
      ctx,
    );
    expect(entry).toEqual({
      numbers: { gold: 3500, range: '200~400' },
      number_sources: { gold: CHANGELOG, range: WIKI },
    });
    expect(blessingCommunitySchema.parse(entry)).toEqual(entry);
  });

  it('keeps a descending range in source order', () => {
    const { entry } = convertNote(note({ numbers: { pct: { range: [8, 4.8], source: WIKI } } }), ctx);
    expect(entry?.numbers).toEqual({ pct: '8~4.8' });
  });

  it('skips unit mismatches and keys that are not template placeholders', () => {
    const { entry, skipped } = convertNote(
      note({
        numbers: {
          gold: { value: 3, unit_mismatch: true, source: WIKI },
          other: { value: 1, source: WIKI },
          pct: { value: 8, source: WIKI },
        },
      }),
      ctx,
    );
    expect(entry?.numbers).toEqual({ pct: 8 });
    expect(skipped).toEqual([
      { id: '10010', what: 'numbers.gold', reason: 'unit_mismatch' },
      { id: '10010', what: 'numbers.other', reason: 'not_placeholder' },
    ]);
  });

  it('imports tips with normalized dates and drops over-long ones', () => {
    const long = '长'.repeat(81);
    const { entry, skipped } = convertNote(
      note({
        tips: [
          { text: ' 仅远程英雄可获得 ', source: WIKI, date: null },
          { text: '削弱 3 次', source: CHANGELOG, date: '2026-05-22T00:00:00Z' },
          { text: long, source: BILI, date: '2026-05' },
        ],
      }),
      ctx,
    );
    expect(entry?.tips).toEqual([
      { text: '仅远程英雄可获得', source: WIKI },
      { text: '削弱 3 次', source: CHANGELOG, date: '2026-05-22' },
    ]);
    expect(skipped).toEqual([{ id: '10010', what: `tip: ${long.slice(0, 20)}…`, reason: 'tip_too_long' }]);
  });

  it('never imports wiki_text', () => {
    const { entry } = convertNote(note({ wiki_text: { text: '原文', source: WIKI } }), ctx);
    expect(entry).toBeUndefined();
  });

  it('maps hero names to ids, dedupes, skips exclusive markers and reports unknown names', () => {
    const { entry, unmapped, skipped } = convertNote(
      note({
        heroes: [
          { hero: '斧王', source: GUIDE, note: '一图流“金色福佑推荐”' },
          { hero: '斧王', source: BILI, note: 'B站实战视频标题中的组合' },
          { hero: '先知', source: BILI, note: 'B站实战视频标题中的组合' },
          { hero: '不存在', source: BILI, note: 'B站实战视频标题中的组合' },
          { hero: '斧王', source: WIKI, note: '图鉴标注的专属英雄' },
        ],
      }),
      ctx,
    );
    expect(entry?.recommended_heroes).toEqual([
      { hero: 'axe', source: GUIDE },
      { hero: 'furion', source: BILI },
    ]);
    expect(unmapped).toEqual(['不存在']);
    expect(skipped).toEqual([{ id: '10010', what: 'hero: 不存在', reason: 'hero_unmapped' }]);
  });
});

describe('normalizeTipDate', () => {
  it('keeps YYYY-MM and YYYY-MM-DD, trims timestamps, drops the rest', () => {
    expect(normalizeTipDate('2026-05')).toBe('2026-05');
    expect(normalizeTipDate('2026-05-22')).toBe('2026-05-22');
    expect(normalizeTipDate('2026-05-22T10:00:00Z')).toBe('2026-05-22');
    expect(normalizeTipDate('2026/05/22')).toBeUndefined();
    expect(normalizeTipDate(null)).toBeUndefined();
  });
});

describe('isPossiblyOutdated', () => {
  const ref = '2026-09-21';
  it('flags dates more than six months before the reference', () => {
    expect(isPossiblyOutdated('2026-03-20', ref)).toBe(true);
    expect(isPossiblyOutdated('2026-03-21', ref)).toBe(false);
    expect(isPossiblyOutdated('2026-09-01', ref)).toBe(false);
  });
  it('reads a month-only date as the end of that month', () => {
    expect(isPossiblyOutdated('2026-03', ref)).toBe(false);
    expect(isPossiblyOutdated('2026-02', ref)).toBe(true);
  });
  it('never flags undated tips', () => {
    expect(isPossiblyOutdated(undefined, ref)).toBe(false);
  });
});

describe('sourceLink', () => {
  it('labels known sources and points wiki API urls at the wiki itself', () => {
    expect(sourceLink(WIKI)).toEqual({ href: 'http://122.51.0.76:8081/', label: '社区图鉴' });
    expect(sourceLink(GUIDE)).toEqual({ href: GUIDE, label: '社区一图流' });
    expect(sourceLink(CHANGELOG)).toEqual({ href: CHANGELOG, label: 'Steam 改动记录' });
    expect(sourceLink('https://steamcommunity.com/sharedfiles/filedetails/?id=2841152696')).toEqual({
      href: 'https://steamcommunity.com/sharedfiles/filedetails/?id=2841152696',
      label: 'Steam 创意工坊',
    });
    expect(sourceLink(BILI)).toEqual({ href: BILI, label: 'B站' });
    expect(sourceLink('https://example.com/a')).toEqual({ href: 'https://example.com/a', label: 'example.com' });
  });
});
