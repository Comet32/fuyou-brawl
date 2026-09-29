import { describe, expect, it } from 'vitest';
import { parseTemplate, placeholderKeys, toPlainText } from '../src/lib/template';

const tpl = "获得 <font color='#83d18a'>{gold}</font> 金币。<font color='#8e8e8e'>（注）</font>";

describe('parseTemplate', () => {
  it('parses highlight values and muted text without numbers', () => {
    expect(parseTemplate(tpl)).toEqual([
      { type: 'text', text: '获得 ', tone: 'normal' },
      { type: 'value', key: 'gold', tone: 'highlight' },
      { type: 'text', text: ' 金币。', tone: 'normal' },
      { type: 'text', text: '（注）', tone: 'muted' },
    ]);
  });
  it('fills known values', () => {
    const segs = parseTemplate(tpl, { gold: 3500 });
    expect(segs[1]).toEqual({ type: 'value', key: 'gold', value: '3500', tone: 'highlight' });
  });
  it('leaves unknown keys without a value', () => {
    const segs = parseTemplate('{a} {b}', { a: '5' });
    expect(segs[0]).toEqual({ type: 'value', key: 'a', value: '5', tone: 'normal' });
    expect(segs[2]).toEqual({ type: 'value', key: 'b', tone: 'normal' });
    expect('value' in segs[2]).toBe(false);
  });
  it('treats other colors as accent, case-insensitively, with double quotes', () => {
    expect(parseTemplate('<font color="#FF6B6B">危险</font>')).toEqual([
      { type: 'text', text: '危险', tone: 'accent' },
    ]);
    expect(parseTemplate("<font color='#83D18A'>ok</font>")).toEqual([
      { type: 'text', text: 'ok', tone: 'highlight' },
    ]);
    expect(parseTemplate("<font color='#8E8E8E'>x</font>")).toEqual([
      { type: 'text', text: 'x', tone: 'muted' },
    ]);
  });
  it('innermost font wins and </font> pops', () => {
    expect(
      parseTemplate("<font color='#83d18a'>a<font color='#8e8e8e'>b</font>c</font>d"),
    ).toEqual([
      { type: 'text', text: 'a', tone: 'highlight' },
      { type: 'text', text: 'b', tone: 'muted' },
      { type: 'text', text: 'c', tone: 'highlight' },
      { type: 'text', text: 'd', tone: 'normal' },
    ]);
  });
  it('ignores unbalanced closing fonts', () => {
    expect(parseTemplate('a</font>b')).toEqual([{ type: 'text', text: 'ab', tone: 'normal' }]);
  });
  it('turns br variants into breaks', () => {
    expect(parseTemplate('a<br>b<br/>c<br />d<BR>e')).toEqual([
      { type: 'text', text: 'a', tone: 'normal' },
      { type: 'break' },
      { type: 'text', text: 'b', tone: 'normal' },
      { type: 'break' },
      { type: 'text', text: 'c', tone: 'normal' },
      { type: 'break' },
      { type: 'text', text: 'd', tone: 'normal' },
      { type: 'break' },
      { type: 'text', text: 'e', tone: 'normal' },
    ]);
  });
  it('drops unknown tags but keeps their text', () => {
    expect(parseTemplate('<b>粗体</b>文字')).toEqual([
      { type: 'text', text: '粗体文字', tone: 'normal' },
    ]);
  });
  it('never emits a tag from script or other markup', () => {
    const segs = parseTemplate("<script>alert(1)</script><img src=x onerror='alert(1)'>hi");
    for (const s of segs) {
      if (s.type === 'text') expect(s.text).not.toMatch(/[<>]/);
    }
    expect(toPlainText("<script>alert(1)</script>hi")).toBe('alert(1)hi');
  });
  it('decodes entities once and does not re-interpret them as tags', () => {
    const segs = parseTemplate('a &amp; b &lt;b&gt; &quot;q&quot; &#39;s&#39;');
    expect(segs).toEqual([{ type: 'text', text: 'a & b <b> "q" \'s\'', tone: 'normal' }]);
  });
  it('does not double-decode entities', () => {
    expect(toPlainText('&amp;lt;')).toBe('&lt;');
  });
  it('does not treat braces with invalid keys as placeholders', () => {
    expect(parseTemplate('{} {a b} {x}')).toEqual([
      { type: 'text', text: '{} {a b} ', tone: 'normal' },
      { type: 'value', key: 'x', tone: 'normal' },
    ]);
  });
  it('treats a lone < as text', () => {
    expect(toPlainText('1 < 2 and 3 > 2')).toBe('1 < 2 and 3 > 2');
  });
  it('returns [] for empty template', () => {
    expect(parseTemplate('')).toEqual([]);
  });
});

describe('toPlainText', () => {
  it('uses ? for unknown values', () => {
    expect(toPlainText(tpl)).toBe('获得 ? 金币。（注）');
  });
  it('uses known values', () => {
    expect(toPlainText(tpl, { gold: 3500 })).toBe('获得 3500 金币。（注）');
  });
  it('renders breaks as a single space and collapses whitespace', () => {
    expect(toPlainText('  a<br>b  <br/>  c \n d ')).toBe('a b c d');
  });
});

describe('placeholderKeys', () => {
  it('returns unique keys in order of appearance', () => {
    expect(placeholderKeys('{b} {a} <font color="#fff">{b}</font> {c_1}')).toEqual(['b', 'a', 'c_1']);
  });
  it('returns [] when none', () => {
    expect(placeholderKeys('nothing here')).toEqual([]);
  });
});
