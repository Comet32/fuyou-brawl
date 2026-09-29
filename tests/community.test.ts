import { describe, expect, it } from 'vitest';
import {
  convertNote,
  isPossiblyOutdated,
  normalizeTipDate,
  parseRange,
  conflictCaption,
  historyEntries,
  normalizeChangeText,
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

  it('skips quality when sources conflict and records every claim instead', () => {
    const GUIDES_API = 'http://122.51.0.76:8081/api/hero-guides';
    const { entry, skipped } = convertNote(
      note({
        quality: { value: 'sr', source: WIKI, date: '2026-09-29' },
        quality_conflicts: [{ value: 'r', source: GUIDES_API, note: 'x' }],
      }),
      ctx,
    );
    expect(entry).toEqual({
      quality_conflict: [
        { quality: 'sr', source: WIKI },
        { quality: 'r', source: GUIDES_API },
      ],
    });
    expect(skipped).toEqual([{ id: '10010', what: 'quality', reason: 'quality_conflict' }]);
    expect(blessingCommunitySchema.parse(entry)).toEqual(entry);
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

  it('splits tips by source: changelog into changes, wiki annotations into wiki_notes, the rest stay tips', () => {
    const long = '长'.repeat(81);
    const COMMENTS = 'https://steamcommunity.com/sharedfiles/filedetails/comments/2841152696';
    const { entry, skipped } = convertNote(
      note({
        tips: [
          { text: ' 图鉴标注：仅远程英雄可获得 ', source: WIKI, date: null },
          { text: '官方改动：削弱', source: CHANGELOG, date: '2026-05-22T00:00:00Z' },
          { text: '一图流推荐', source: GUIDE, date: '2026-04-14' },
          { text: '一图流合计', source: 'http://122.51.0.76:8081/api/hero-guides', date: '2026-09' },
          { text: 'UP 主确认', source: BILI, date: '2026-05' },
          { text: '留言反馈', source: COMMENTS, date: '2026-08-27' },
          { text: long, source: BILI, date: '2026-05' },
        ],
      }),
      ctx,
    );
    expect(entry?.wiki_notes).toEqual([{ text: '图鉴标注：仅远程英雄可获得', source: WIKI }]);
    expect(entry?.changes).toEqual([{ date: '2026-05-22', text: '削弱', source: CHANGELOG }]);
    expect(entry?.tips).toEqual([
      { text: '一图流推荐', source: GUIDE, date: '2026-04-14' },
      { text: '一图流合计', source: 'http://122.51.0.76:8081/api/hero-guides', date: '2026-09' },
      { text: 'UP 主确认', source: BILI, date: '2026-05' },
      { text: '留言反馈', source: COMMENTS, date: '2026-08-27' },
    ]);
    expect(skipped).toEqual([{ id: '10010', what: `tip: ${long.slice(0, 20)}…`, reason: 'tip_too_long' }]);
    expect(blessingCommunitySchema.parse(entry)).toEqual(entry);
  });

  it('turns the balance statistics line into a change summary instead of a change', () => {
    const { entry } = convertNote(
      note({
        tips: [
          { text: '官方平衡记录（2026-02起）：增强0次、削弱3次；最近一次2026-05-22削弱', source: CHANGELOG, date: '2026-05-22' },
          { text: '官方改动：品质下调为蓝色', source: CHANGELOG, date: '2026-05-25' },
        ],
      }),
      ctx,
    );
    expect(entry?.change_summary).toEqual({
      text: '2026-02 以来官方增强 0 次、削弱 3 次，最近一次是 2026-05-22 削弱',
      source: CHANGELOG,
    });
    expect(entry?.changes).toEqual([{ date: '2026-05-25', text: '品质下调为蓝色', source: CHANGELOG }]);
    expect(blessingCommunitySchema.parse(entry)).toEqual(entry);
  });

  it('keeps an undated changelog note as a wiki-style note rather than inventing a date', () => {
    const { entry } = convertNote(note({ tips: [{ text: '官方改动', source: CHANGELOG, date: null }] }), ctx);
    expect(entry).toEqual({ wiki_notes: [{ text: '官方改动', source: CHANGELOG }] });
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
    expect(sourceLink(WIKI)).toEqual({ href: 'http://122.51.0.76:8081/', label: '社区图鉴', short: '图鉴' });
    expect(sourceLink('http://122.51.0.76:8081/api/hero-guides')).toEqual({
      href: 'http://122.51.0.76:8081/',
      label: '社区一图流',
      short: '一图流',
    });
    expect(sourceLink(GUIDE)).toEqual({ href: GUIDE, label: '社区一图流', short: '一图流' });
    expect(sourceLink(CHANGELOG)).toEqual({ href: CHANGELOG, label: 'Steam 改动记录', short: 'Steam' });
    expect(sourceLink('https://steamcommunity.com/sharedfiles/filedetails/?id=2841152696')).toEqual({
      href: 'https://steamcommunity.com/sharedfiles/filedetails/?id=2841152696',
      label: 'Steam 创意工坊',
      short: 'Steam',
    });
    expect(sourceLink(BILI)).toEqual({ href: BILI, label: 'B站', short: 'B站' });
    expect(sourceLink('https://example.com/a')).toEqual({
      href: 'https://example.com/a',
      label: 'example.com',
      short: 'example.com',
    });
  });
});

describe('parseRange', () => {
  it('splits "a~b" range strings, in either direction', () => {
    expect(parseRange('200~400')).toEqual(['200', '400']);
    expect(parseRange('8~4.8')).toEqual(['8', '4.8']);
    expect(parseRange('-5~-1')).toEqual(['-5', '-1']);
  });
  it('returns undefined for plain values', () => {
    expect(parseRange(3500)).toBeUndefined();
    expect(parseRange('3500')).toBeUndefined();
    expect(parseRange('雷神之锤')).toBeUndefined();
  });
});

describe('conflictCaption', () => {
  it('names each source with its colour', () => {
    expect(
      conflictCaption([
        { quality: 'sr', source: WIKI },
        { quality: 'r', source: 'http://122.51.0.76:8081/api/hero-guides' },
      ]),
    ).toBe('品质说法不一 · 图鉴紫 / 一图流蓝');
  });
  it('falls back to a bare caption without claims', () => {
    expect(conflictCaption([])).toBe('品质说法不一');
  });
});

describe('historyEntries', () => {
  it('merges manual history and community changes, newest first', () => {
    const out = historyEntries(
      [{ version: '2026-09-01', change: '金币 3000→3500' }],
      [
        { date: '2026-03-24', text: '图鉴改动', source: CHANGELOG },
        { date: '2026-05', text: '五月改动', source: CHANGELOG },
      ],
    );
    expect(out).toEqual([
      { date: '2026-09-01', text: '金币 3000→3500', version: '2026-09-01' },
      { date: '2026-05', text: '五月改动', source: CHANGELOG },
      { date: '2026-03-24', text: '图鉴改动', source: CHANGELOG },
    ]);
  });
  it('is empty when there is nothing', () => {
    expect(historyEntries([], [])).toEqual([]);
  });
});

describe('normalizeChangeText', () => {
  it('drops the 官方 prefix but keeps what kind of note it is', () => {
    expect(normalizeChangeText('官方改动：调入攻速/攻击福佑池', '2026-08-08')).toBe('调入攻速/攻击福佑池');
    expect(normalizeChangeText('官方：以橙色福佑身份新增', '2026-03-06')).toBe('以橙色福佑身份新增');
    expect(normalizeChangeText('官方修复：解除附身时减益免疫未正确结束的问题', '2026-05-25')).toBe(
      '修复：解除附身时减益免疫未正确结束的问题',
    );
  });
  it('removes the entry date when the text repeats it', () => {
    expect(normalizeChangeText('官方更新：2026-04-03 品质上调一档', '2026-04-03')).toBe('品质上调一档');
    expect(normalizeChangeText('官方：5月21日新增的24个福佑之一', '2026-05-21')).toBe('新增的24个福佑之一');
    expect(normalizeChangeText('官方：新增福佑（2月21日版本）', '2026-02-21')).toBe('新增福佑');
    expect(normalizeChangeText('官方：肉身成圣四件套于2月23日加入', '2026-02-23')).toBe('肉身成圣四件套加入');
  });
  it('keeps other dates, such as when a change takes effect', () => {
    expect(normalizeChangeText('官方改动：已从福佑池移除（5月4日生效）', '2026-04-30')).toBe('已从福佑池移除（5月4日生效）');
  });
});
