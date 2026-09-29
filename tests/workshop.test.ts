import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildIssue, formatBeijingDate, htmlToText, parseChangelog } from '../src/lib/workshop';

const html = readFileSync(new URL('./fixtures/changelog.html', import.meta.url), 'utf8');
const URL_ = 'https://steamcommunity.com/sharedfiles/filedetails/changelog/2841152696';

describe('htmlToText', () => {
  it('converts <br> to newlines and decodes entities', () => {
    expect(htmlToText('a<br>b &amp; <b>c</b>')).toBe('a\nb & c');
  });
  it('decodes decimal and hex numeric entities', () => {
    expect(htmlToText('it&#039;s &#12290; &#x27;x&#X27;')).toBe("it's 。 'x'");
  });
  it('decodes named entities case-insensitively and leaves unknown ones', () => {
    expect(htmlToText('&AMP; &lt;b&gt; &quot;q&quot; &apos; a&nbsp;b &foo;')).toBe('& <b> "q" \' a b &foo;');
  });
  it('turns list items and block ends into lines', () => {
    expect(htmlToText('<ul><li>one</li><li class="x">two</li></ul>')).toBe('- one\n- two');
    expect(htmlToText('<div>a</div><p>b</p>')).toBe('a\nb');
  });
  it('normalizes CRLF, trims each line and collapses blank runs', () => {
    expect(htmlToText('  a\t\r\n\r\n\r\n\r\n  b \t ')).toBe('a\n\nb');
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
  it('marks an exact timestamp match with the plain heading', () => {
    const issue = buildIssue(1790596800 + 3600, parseChangelog(html), URL_);
    expect(issue.body).toContain('### 更新日志原文');
    expect(issue.body).not.toContain('未找到对应时间');
  });
  it('warns when falling back to the latest entry', () => {
    const issue = buildIssue(1700000000, parseChangelog(html), URL_);
    expect(issue.body).toContain('### ⚠️ 未找到对应时间的日志，以下为最新一条');
    expect(issue.body).not.toContain('### 更新日志原文');
    expect(issue.body).toContain('> 电锤思维：金币 3000→3500');
  });
  it('neutralizes mentions and issue refs in quoted text', () => {
    const entries = [{ timestamp: 1790596800, text: 'thanks @someone, fixes #12\nsee C#, #tag' }];
    const issue = buildIssue(1790596800, entries, URL_);
    expect(issue.body).toContain('> thanks @\u200bsomeone, fixes #\u200b12');
    expect(issue.body).toContain('> see C#, #tag');
    expect(issue.body).not.toContain('@someone');
  });
  it('falls back when changelog could not be parsed', () => {
    const issue = buildIssue(1790596800, [], URL_);
    expect(issue.body).toContain('未能解析更新日志');
  });
});
