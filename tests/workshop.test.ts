import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildIssue, formatBeijingDate, htmlToText, parseChangelog } from '../src/lib/workshop';

const html = readFileSync(new URL('./fixtures/changelog.html', import.meta.url), 'utf8');
const URL_ = 'https://steamcommunity.com/sharedfiles/filedetails/changelog/2841152696';

describe('htmlToText', () => {
  it('converts <br> to newlines and decodes entities', () => {
    expect(htmlToText('a<br>b &amp; <b>c</b>')).toBe('a\nb & c');
  });
});

describe('parseChangelog', () => {
  it('extracts entries newest first', () => {
    const entries = parseChangelog(html);
    expect(entries.map((e) => e.timestamp)).toEqual([1790596800, 1788264000]);
    expect(entries[0].text).toBe('【福佑调整】\n电锤思维：金币 3000→3500\n新增福佑「救援」 & 修复若干问题');
  });
  it('returns [] for unrelated html', () => {
    expect(parseChangelog('<html></html>')).toEqual([]);
  });
});

describe('formatBeijingDate', () => {
  it('formats in UTC+8', () => {
    expect(formatBeijingDate(1790596800)).toBe('2026-09-28');
  });
});

describe('buildIssue', () => {
  it('quotes the entry matching time_updated', () => {
    const issue = buildIssue(1790596800, parseChangelog(html), URL_);
    expect(issue.key).toBe('v1790596800');
    expect(issue.title).toBe('[游戏更新] 2026-09-28 v1790596800');
    expect(issue.body).toContain('> 电锤思维：金币 3000→3500');
    expect(issue.body).toContain(URL_);
    expect(issue.body).toContain('- [ ] 更新 `src/data/versions.yaml`');
  });
  it('falls back when changelog could not be parsed', () => {
    const issue = buildIssue(1790596800, [], URL_);
    expect(issue.body).toContain('未能解析更新日志');
  });
});
