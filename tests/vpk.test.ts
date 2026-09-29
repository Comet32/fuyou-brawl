import { describe, expect, it } from 'vitest';
import { readVpkEntries, readVpkFile } from '../src/lib/vpk';

interface FakeFile {
  ext: string; // ' ' = no extension
  dir: string; // ' ' = root
  name: string;
  data: string;
  preload?: string;
  archiveIndex?: number;
}

const enc = new TextEncoder();
const cstr = (s: string) => [...enc.encode(s), 0];

/** Build a single-file VPK (v1 or v2) holding `files`, grouped ext -> dir -> name as Valve's tree is. */
function buildVpk(files: FakeFile[], version: 1 | 2 = 2, signature = 0x55aa1234): Uint8Array {
  const tree: number[] = [];
  const data: number[] = [];
  const u16 = (v: number) => tree.push(v & 0xff, (v >> 8) & 0xff);
  const u32 = (v: number) => tree.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff);

  const byExt = Map.groupBy(files, (f) => f.ext);
  for (const [ext, extFiles] of byExt) {
    tree.push(...cstr(ext));
    for (const [dir, dirFiles] of Map.groupBy(extFiles, (f) => f.dir)) {
      tree.push(...cstr(dir));
      for (const f of dirFiles) {
        const body = enc.encode(f.data);
        const pre = enc.encode(f.preload ?? '');
        tree.push(...cstr(f.name));
        u32(0xdeadbeef); // crc (not checked)
        u16(pre.length);
        u16(f.archiveIndex ?? 0x7fff);
        u32(data.length);
        u32(body.length);
        u16(0xffff);
        tree.push(...pre);
        data.push(...body);
      }
      tree.push(0); // end of names
    }
    tree.push(0); // end of dirs
  }
  tree.push(0); // end of exts

  const headerSize = version === 1 ? 12 : 28;
  const header = new DataView(new ArrayBuffer(headerSize));
  header.setUint32(0, signature, true);
  header.setUint32(4, version, true);
  header.setUint32(8, tree.length, true);
  if (version === 2) header.setUint32(12, data.length, true);

  const out = new Uint8Array(headerSize + tree.length + data.length);
  out.set(new Uint8Array(header.buffer), 0);
  out.set(tree, headerSize);
  out.set(data, headerSize + tree.length);
  return out;
}

const dec = (b: Uint8Array) => new TextDecoder().decode(b);

const FILES: FakeFile[] = [
  { ext: 'csv', dir: 'resource', name: 'bless_name', data: 'Tokens,Schinese\nbless_10010,电锤思维\n' },
  { ext: 'png', dir: 'resource/flash3/images/spellicons/buff/bless', name: '10010', data: 'PNG!', preload: 'PRE' },
  { ext: 'txt', dir: ' ', name: 'addon', data: 'root file' },
  { ext: ' ', dir: 'scripts', name: 'LICENSE', data: 'no ext' },
];

describe('readVpkEntries', () => {
  it('lists every file with its full path (root dir and missing extension handled)', () => {
    const entries = readVpkEntries(buildVpk(FILES));
    expect([...entries.keys()].sort()).toEqual([
      'addon.txt',
      'resource/bless_name.csv',
      'resource/flash3/images/spellicons/buff/bless/10010.png',
      'scripts/LICENSE',
    ]);
  });

  it('reports absolute offsets, lengths, preload bytes and archive index', () => {
    const buf = buildVpk(FILES);
    const e = readVpkEntries(buf).get('resource/flash3/images/spellicons/buff/bless/10010.png')!;
    expect(e.length).toBe(4);
    expect(e.archiveIndex).toBe(0x7fff);
    expect(dec(e.preload)).toBe('PRE');
    expect(dec(buf.subarray(e.offset, e.offset + e.length))).toBe('PNG!');
  });

  it('reads v1 archives (12-byte header)', () => {
    const buf = buildVpk(FILES, 1);
    const entries = readVpkEntries(buf);
    expect(dec(readVpkFile(buf, entries.get('addon.txt')!))).toBe('root file');
  });

  it('rejects a bad signature', () => {
    expect(() => readVpkEntries(buildVpk(FILES, 2, 0x12345678))).toThrow(/signature/i);
  });

  it('rejects an unsupported version', () => {
    const buf = buildVpk(FILES);
    new DataView(buf.buffer).setUint32(4, 3, true);
    expect(() => readVpkEntries(buf)).toThrow(/version/i);
  });

  it('rejects a truncated tree', () => {
    const buf = buildVpk(FILES);
    expect(() => readVpkEntries(buf.subarray(0, 40))).toThrow(/truncated/i);
  });
});

describe('readVpkFile', () => {
  it('returns preload + data', () => {
    const buf = buildVpk(FILES);
    const entries = readVpkEntries(buf);
    expect(dec(readVpkFile(buf, entries.get('resource/flash3/images/spellicons/buff/bless/10010.png')!))).toBe(
      'PREPNG!',
    );
    expect(dec(readVpkFile(buf, entries.get('resource/bless_name.csv')!))).toBe(
      'Tokens,Schinese\nbless_10010,电锤思维\n',
    );
    expect(dec(readVpkFile(buf, entries.get('scripts/LICENSE')!))).toBe('no ext');
  });

  it('throws for entries stored in a separate archive', () => {
    const buf = buildVpk([{ ext: 'txt', dir: ' ', name: 'far', data: 'x', archiveIndex: 0 }]);
    const e = readVpkEntries(buf).get('far.txt')!;
    expect(() => readVpkFile(buf, e)).toThrow(/archive/i);
  });

  it('throws when the data runs past the end of the buffer', () => {
    const buf = buildVpk(FILES);
    const e = readVpkEntries(buf).get('resource/bless_name.csv')!;
    expect(() => readVpkFile(buf.subarray(0, e.offset + 2), e)).toThrow(/out of bounds/i);
  });
});
