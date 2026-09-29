/**
 * Minimal reader for Valve VPK directory files (v1/v2).
 * Only single-file archives are fully supported: entries whose data lives in
 * the directory file itself (archive index 0x7FFF) can be extracted.
 */

export interface VpkEntry {
  /** Absolute byte offset of the entry's data within the VPK buffer. */
  offset: number;
  length: number;
  /** Bytes stored inline in the tree; they come before the data. */
  preload: Uint8Array;
  archiveIndex: number;
}

const SIGNATURE = 0x55aa1234;
const HEADER_SIZE: Record<number, number> = { 1: 12, 2: 28 };
/** Archive index meaning "data follows the tree in this same file". */
export const EMBEDDED_ARCHIVE = 0x7fff;
const ENTRY_TERMINATOR = 0xffff;

const decoder = new TextDecoder('utf-8');

/** Parse the directory tree. Keys are full paths such as "resource/bless_name.csv". */
export function readVpkEntries(buf: Uint8Array): Map<string, VpkEntry> {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const need = (pos: number, n: number) => {
    if (pos + n > buf.length) throw new Error(`VPK truncated at byte ${pos}`);
  };

  need(0, 12);
  const signature = view.getUint32(0, true);
  if (signature !== SIGNATURE) throw new Error(`Not a VPK file: bad signature 0x${signature.toString(16)}`);
  const version = view.getUint32(4, true);
  const headerSize = HEADER_SIZE[version];
  if (!headerSize) throw new Error(`Unsupported VPK version ${version}`);
  const treeSize = view.getUint32(8, true);
  need(0, headerSize + treeSize);
  const dataBase = headerSize + treeSize;

  let pos = headerSize;
  const readString = (): string => {
    const end = buf.indexOf(0, pos);
    if (end < 0 || end >= dataBase) throw new Error(`VPK truncated: unterminated string at byte ${pos}`);
    const s = decoder.decode(buf.subarray(pos, end));
    pos = end + 1;
    return s;
  };

  const entries = new Map<string, VpkEntry>();
  for (let ext = readString(); ext; ext = readString()) {
    for (let dir = readString(); dir; dir = readString()) {
      for (let name = readString(); name; name = readString()) {
        need(pos, 18);
        const preloadBytes = view.getUint16(pos + 4, true);
        const archiveIndex = view.getUint16(pos + 6, true);
        const entryOffset = view.getUint32(pos + 8, true);
        const length = view.getUint32(pos + 12, true);
        const terminator = view.getUint16(pos + 16, true);
        if (terminator !== ENTRY_TERMINATOR) throw new Error(`VPK corrupt: bad entry terminator at byte ${pos + 16}`);
        pos += 18;
        need(pos, preloadBytes);
        const preload = buf.slice(pos, pos + preloadBytes);
        pos += preloadBytes;

        const path = (dir === ' ' ? '' : `${dir}/`) + name + (ext === ' ' ? '' : `.${ext}`);
        entries.set(path, {
          // Offsets into external archives are relative to that archive, not this buffer.
          offset: archiveIndex === EMBEDDED_ARCHIVE ? dataBase + entryOffset : entryOffset,
          length,
          preload,
          archiveIndex,
        });
      }
    }
  }
  return entries;
}

/** Extract one entry's full contents (preload bytes followed by the data). */
export function readVpkFile(buf: Uint8Array, entry: VpkEntry): Uint8Array {
  if (entry.archiveIndex !== EMBEDDED_ARCHIVE) {
    throw new Error(`VPK entry is stored in external archive ${entry.archiveIndex}, which is not supported`);
  }
  if (entry.offset + entry.length > buf.length) throw new Error('VPK entry data is out of bounds');
  const out = new Uint8Array(entry.preload.length + entry.length);
  out.set(entry.preload, 0);
  out.set(buf.subarray(entry.offset, entry.offset + entry.length), entry.preload.length);
  return out;
}
