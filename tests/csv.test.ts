import { describe, expect, it } from 'vitest';
import { parseCsv } from '../src/lib/csv';

describe('parseCsv', () => {
  it('parses simple rows', () => {
    expect(parseCsv('a,b,c\n1,2,3\n')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });
  it('strips a leading BOM', () => {
    expect(parseCsv('﻿Tokens,Schinese\nx,y')).toEqual([
      ['Tokens', 'Schinese'],
      ['x', 'y'],
    ]);
  });
  it('handles quoted fields with commas', () => {
    expect(parseCsv('a,"b,c",d')).toEqual([['a', 'b,c', 'd']]);
  });
  it('handles quoted fields with newlines', () => {
    expect(parseCsv('a,"line1\nline2",c\nx,y,z')).toEqual([
      ['a', 'line1\nline2', 'c'],
      ['x', 'y', 'z'],
    ]);
  });
  it('unescapes doubled quotes', () => {
    expect(parseCsv('a,"say ""hi""",c')).toEqual([['a', 'say "hi"', 'c']]);
  });
  it('handles CRLF line endings', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
  it('keeps CRLF inside quoted fields', () => {
    expect(parseCsv('a,"x\r\ny"\r\nb,c')).toEqual([
      ['a', 'x\r\ny'],
      ['b', 'c'],
    ]);
  });
  it('drops a trailing empty line but keeps empty fields', () => {
    expect(parseCsv('a,,c\n,,\n')).toEqual([
      ['a', '', 'c'],
      ['', '', ''],
    ]);
  });
  it('handles a missing final newline', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
  it('keeps an empty quoted field at the end of the last row', () => {
    expect(parseCsv('a,""')).toEqual([['a', '']]);
  });
  it('returns [] for empty input', () => {
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv('﻿')).toEqual([]);
  });
  it('keeps single quotes and html attributes untouched', () => {
    expect(parseCsv("t,\"<font color='#83d18a'>{gold}</font>\"")).toEqual([
      ['t', "<font color='#83d18a'>{gold}</font>"],
    ]);
  });
});
