import { describe, expect, it } from 'vitest';
import { describeSource } from '../src/lib/sources';

const entries = [
  { url: 'https://www.bilibili.com/video/BV15CQPBcEKt/', title: '从夯到拉锐评所有福佑（紫色通用第一期）', site: 'B站', date: '2026-04-10' },
  { url: 'http://122.51.0.76:8081', title: '福佑大乱斗 技能图鉴', site: '社区图鉴站' },
];

describe('describeSource', () => {
  it('reads title, site and date from the registry', () => {
    expect(describeSource('https://www.bilibili.com/video/BV15CQPBcEKt/', entries)).toEqual({
      href: 'https://www.bilibili.com/video/BV15CQPBcEKt/',
      parts: ['从夯到拉锐评所有福佑（紫色通用第一期）', 'B站', '2026-04-10'],
    });
  });
  it('matches urls regardless of a trailing slash', () => {
    expect(describeSource('http://122.51.0.76:8081/', entries).parts).toEqual(['福佑大乱斗 技能图鉴', '社区图鉴站']);
  });
  it('falls back to the hostname', () => {
    expect(describeSource('https://example.com/a/b', entries)).toEqual({ href: 'https://example.com/a/b', parts: ['example.com'] });
  });
});
