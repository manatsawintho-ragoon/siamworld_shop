import * as fs from 'fs';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gunzip = promisify(zlib.gunzip);

/**
 * Incremental reader for a rotating access log.
 *
 * Two things make this less trivial than "remember a byte offset":
 *
 * 1. **Partial lines.** A live corpus sample contained a line truncated
 *    mid-field with the following line appended to it, i.e. the reader caught
 *    nginx mid-write. Consuming a trailing partial line would both corrupt that
 *    record and permanently skip the real one, so the cursor only ever advances
 *    to the last newline it actually saw.
 *
 * 2. **Rotation.** NPM rotates weekly with `create` + `kill -USR1` (not
 *    copytruncate), so the path gets a fresh inode. Resuming at the old offset
 *    in the new file would skip a week of traffic, so rotation is detected by
 *    inode change (or by the file shrinking) and the tail of the archived file
 *    is drained first.
 *
 * Detecting rotation by inode assumes the old inode is not immediately reused
 * by the replacement file. logrotate's `create` mode guarantees this: it
 * renames the log first, so the archive still holds the old inode when the new
 * file is created, and the intermediate is only unlinked after compression. A
 * bare unlink-then-create sequence could reuse the inode and defeat this, but
 * nothing in the rotation path does that.
 */

export interface CursorState {
  inode: number;
  offset: number;
}

export interface ReadResult {
  lines: string[];
  /** Offset to persist. Always lands on a line boundary. */
  offset: number;
  inode: number;
  rotated: boolean;
  /** True when the per-pass byte cap stopped us short; the next pass continues. */
  cappedAt: boolean;
  missing: boolean;
}

/** Bounds one pass so a runaway log cannot exhaust panel memory. */
const DEFAULT_MAX_BYTES = 32 * 1024 * 1024;

const EMPTY = (inode = 0, offset = 0): ReadResult => ({
  lines: [], offset, inode, rotated: false, cappedAt: false, missing: false,
});

/**
 * Split a buffer into complete lines, discarding any trailing partial line.
 * Returns how many bytes were actually consumed, which is what the caller
 * persists. Slicing is done on the Buffer rather than the decoded string
 * because byte offsets and character offsets diverge under UTF-8.
 */
function completeLines(buf: Buffer): { lines: string[]; consumed: number } {
  const lastNl = buf.lastIndexOf(0x0a);
  if (lastNl === -1) return { lines: [], consumed: 0 };
  const consumed = lastNl + 1;
  const lines = buf.subarray(0, consumed).toString('utf8').split('\n').filter(l => l.length > 0);
  return { lines, consumed };
}

async function readRange(filePath: string, start: number, end: number): Promise<Buffer> {
  if (end <= start) return Buffer.alloc(0);
  const fh = await fs.promises.open(filePath, 'r');
  try {
    const buf = Buffer.alloc(end - start);
    const { bytesRead } = await fh.read(buf, 0, buf.length, start);
    return buf.subarray(0, bytesRead);
  } finally {
    await fh.close();
  }
}

/**
 * After rotation, the lines written between our last read and the rotation now
 * live in the archived file. Its uncompressed content is exactly the old file,
 * so the old offset still indexes into it correctly.
 */
async function drainArchive(filePath: string, fromOffset: number): Promise<string[]> {
  for (const candidate of [`${filePath}.1.gz`, `${filePath}.1`]) {
    let raw: Buffer;
    try {
      raw = await fs.promises.readFile(candidate);
    } catch {
      continue;
    }
    let content: Buffer;
    try {
      content = candidate.endsWith('.gz') ? Buffer.from(await gunzip(raw)) : raw;
    } catch {
      continue; // half-written .gz; the next pass will not retry, so accept the gap
    }
    if (fromOffset >= content.length) return [];
    return completeLines(content.subarray(fromOffset)).lines;
  }
  return [];
}

export async function readNewLines(
  filePath: string,
  prev: CursorState | null,
  opts: { maxBytes?: number } = {},
): Promise<ReadResult> {
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;

  let st: fs.Stats;
  try {
    st = await fs.promises.stat(filePath);
  } catch {
    return { ...EMPTY(prev?.inode ?? 0, prev?.offset ?? 0), missing: true };
  }

  const inode = Number(st.ino);
  const rotated = prev !== null && (prev.inode !== inode || st.size < prev.offset);

  const carried = rotated ? await drainArchive(filePath, prev!.offset) : [];
  const start = rotated || prev === null ? 0 : prev.offset;

  const end = Math.min(st.size, start + maxBytes);
  const buf = await readRange(filePath, start, end);
  const { lines, consumed } = completeLines(buf);

  return {
    lines: [...carried, ...lines],
    offset: start + consumed,
    inode,
    rotated,
    cappedAt: end < st.size,
    missing: false,
  };
}
