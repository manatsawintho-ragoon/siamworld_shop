import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as zlib from 'zlib';
import { readNewLines } from '../log-cursor';

let dir: string;
let logPath: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'traffic-cursor-'));
  logPath = path.join(dir, 'proxy-host-1_access.log');
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const inodeOf = (p: string) => Number(fs.statSync(p).ino);

describe('readNewLines', () => {
  it('reads every complete line from a fresh file', async () => {
    fs.writeFileSync(logPath, 'a\nb\nc\n');
    const r = await readNewLines(logPath, null);
    expect(r.lines).toEqual(['a', 'b', 'c']);
    expect(r.offset).toBe(6);
  });

  it('resumes from the stored offset and returns only new lines', async () => {
    fs.writeFileSync(logPath, 'a\nb\n');
    const first = await readNewLines(logPath, null);
    fs.appendFileSync(logPath, 'c\nd\n');
    const second = await readNewLines(logPath, { inode: first.inode, offset: first.offset });
    expect(second.lines).toEqual(['c', 'd']);
  });

  it('returns nothing when there is nothing new', async () => {
    fs.writeFileSync(logPath, 'a\n');
    const first = await readNewLines(logPath, null);
    const second = await readNewLines(logPath, { inode: first.inode, offset: first.offset });
    expect(second.lines).toEqual([]);
    expect(second.offset).toBe(first.offset);
  });

  // The live corpus contained a line truncated mid-field with the next line
  // appended to it: a reader can catch nginx mid-write. Consuming that partial
  // line would corrupt one record AND permanently skip the real one.
  it('does not consume a trailing partial line', async () => {
    fs.writeFileSync(logPath, 'complete\npar');
    const r = await readNewLines(logPath, null);
    expect(r.lines).toEqual(['complete']);
    expect(r.offset).toBe(9); // stops after "complete\n", not after "par"
  });

  it('emits the once-partial line exactly once, after it is completed', async () => {
    fs.writeFileSync(logPath, 'complete\npar');
    const first = await readNewLines(logPath, null);
    fs.appendFileSync(logPath, 'tial\n');
    const second = await readNewLines(logPath, { inode: first.inode, offset: first.offset });
    expect(second.lines).toEqual(['partial']);
  });

  it('yields no lines and consumes nothing when the only content is partial', async () => {
    fs.writeFileSync(logPath, 'nonewline');
    const r = await readNewLines(logPath, null);
    expect(r.lines).toEqual([]);
    expect(r.offset).toBe(0);
  });

  it('does not split a multi-byte character across the offset boundary', async () => {
    fs.writeFileSync(logPath, 'ก้าวหน้า\n');
    const r = await readNewLines(logPath, null);
    expect(r.lines).toEqual(['ก้าวหน้า']);
  });

  describe('rotation', () => {
    it('drains the compressed remainder then reads the new file, with no gap and no repeat', async () => {
      fs.writeFileSync(logPath, 'old1\nold2\n');
      const first = await readNewLines(logPath, null);
      expect(first.lines).toEqual(['old1', 'old2']);

      // More lines land before logrotate runs; we have not read them yet.
      fs.appendFileSync(logPath, 'old3\nold4\n');

      // Real logrotate order, per /etc/logrotate.d in the NPM image:
      // rename (old inode follows the archive), `create` a fresh log, USR1 so
      // nginx reopens, and only then compress and drop the intermediate. The
      // old inode is therefore still occupied when the new file is created,
      // which is why inode reuse cannot confuse the detector in production.
      fs.renameSync(logPath, logPath + '.1');
      fs.writeFileSync(logPath, 'new1\nnew2\n');
      fs.writeFileSync(logPath + '.1.gz', zlib.gzipSync(fs.readFileSync(logPath + '.1')));
      fs.unlinkSync(logPath + '.1');

      const second = await readNewLines(logPath, { inode: first.inode, offset: first.offset });
      expect(second.rotated).toBe(true);
      expect(second.lines).toEqual(['old3', 'old4', 'new1', 'new2']);
      expect(second.inode).toBe(inodeOf(logPath));
    });

    it('handles an uncompressed .1 rotation', async () => {
      fs.writeFileSync(logPath, 'old1\n');
      const first = await readNewLines(logPath, null);
      fs.appendFileSync(logPath, 'old2\n');
      fs.renameSync(logPath, logPath + '.1');
      fs.writeFileSync(logPath, 'new1\n');
      const second = await readNewLines(logPath, { inode: first.inode, offset: first.offset });
      expect(second.lines).toEqual(['old2', 'new1']);
    });

    it('treats a shrunken file as rotated even if the inode is unchanged', async () => {
      fs.writeFileSync(logPath, 'a\nb\nc\n');
      const first = await readNewLines(logPath, null);
      fs.writeFileSync(logPath, 'z\n'); // truncated in place
      const second = await readNewLines(logPath, { inode: inodeOf(logPath), offset: first.offset });
      expect(second.rotated).toBe(true);
      expect(second.lines).toEqual(['z']);
    });

    it('still reads the new file when the rotated archive is missing', async () => {
      fs.writeFileSync(logPath, 'old\n');
      const first = await readNewLines(logPath, null);
      fs.renameSync(logPath, logPath + '.1');
      fs.writeFileSync(logPath, 'new\n');
      fs.unlinkSync(logPath + '.1');
      const second = await readNewLines(logPath, { inode: first.inode, offset: first.offset });
      expect(second.lines).toEqual(['new']);
    });
  });

  it('caps how much it reads in one pass and reports the cap was hit', async () => {
    fs.writeFileSync(logPath, 'x\n'.repeat(1000));
    const r = await readNewLines(logPath, null, { maxBytes: 100 });
    expect(r.cappedAt).toBe(true);
    expect(r.lines.length).toBe(50);
    expect(r.offset).toBe(100);
  });

  it('returns an empty result for a missing file instead of throwing', async () => {
    const r = await readNewLines(path.join(dir, 'nope.log'), null);
    expect(r.lines).toEqual([]);
    expect(r.missing).toBe(true);
  });
});
