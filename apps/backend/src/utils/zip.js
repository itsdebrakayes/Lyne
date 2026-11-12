/**
 * zip.js — a small ZIP writer (deflate), so an export is one file.
 *
 * The format is simple enough that a dependency is not worth its supply-chain
 * surface: for each file a local header and its deflated bytes, then a central
 * directory repeating the headers with offsets, then an end record. Names are
 * UTF-8 (general-purpose flag bit 11). No ZIP64: an export over 4 GB or 65,535
 * files is refused rather than written wrong.
 */
const zlib = require('zlib');

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

/** CRC-32 of buf; pass the previous result to continue over several chunks. */
function crc32(buf, previous = 0) {
  let crc = (previous ^ 0xFFFFFFFF) >>> 0;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function dosDateTime(date) {
  const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const day = (Math.max(d.getFullYear(), 1980) - 1980) << 9 | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, day };
}

/**
 * Files are written in chunks: begin(name), write(chunk) as often as needed,
 * end(). Each chunk is deflated when it arrives (a sync-flushed block, so the
 * blocks join into one valid deflate stream) and the original is let go, so an
 * export holds its compressed bytes and one chunk, never a whole table.
 *
 * Sizes and the CRC are only known at end(), so each file is followed by a data
 * descriptor (general-purpose flag bit 3), which every unzip understands.
 */
class ZipWriter {
  constructor(when = new Date()) {
    Object.assign(this, dosDateTime(when));
    this.parts = [];
    this.central = [];
    this.offset = 0;
    this.count = 0;
    this.open = null;
  }

  begin(fileName) {
    if (this.open) throw new Error('Finish the previous file first.');
    if (this.count >= 65535) throw new Error('Too many files for one archive.');
    const name = Buffer.from(String(fileName).replace(/\\/g, '/').replace(/^\/+/, ''), 'utf8');
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);          // version needed
    local.writeUInt16LE(0x0808, 6);      // UTF-8 names + sizes follow the data
    local.writeUInt16LE(8, 8);           // deflate
    local.writeUInt16LE(this.time, 10);
    local.writeUInt16LE(this.day, 12);   // crc and sizes stay 0 here
    local.writeUInt16LE(name.length, 26);
    this.parts.push(local, name);
    this.open = { name, start: this.offset, crc: 0, raw: 0, packed: 0 };
    this.offset += local.length + name.length;
  }

  write(data) {
    if (!this.open) throw new Error('No file is open.');
    const raw = Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'utf8');
    if (!raw.length) return;
    const packed = zlib.deflateRawSync(raw, { level: 6, finishFlush: zlib.constants.Z_SYNC_FLUSH });
    this.open.crc = crc32(raw, this.open.crc);
    this.open.raw += raw.length;
    this.open.packed += packed.length;
    this.parts.push(packed);
    this.offset += packed.length;
  }

  end() {
    const f = this.open;
    if (!f) throw new Error('No file is open.');
    const last = zlib.deflateRawSync(Buffer.alloc(0));   // the final, empty block
    f.packed += last.length;
    const descriptor = Buffer.alloc(16);
    descriptor.writeUInt32LE(0x08074b50, 0);
    descriptor.writeUInt32LE(f.crc, 4);
    descriptor.writeUInt32LE(f.packed, 8);
    descriptor.writeUInt32LE(f.raw, 12);
    this.parts.push(last, descriptor);
    this.offset += last.length + descriptor.length;

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);          // version made by
    entry.writeUInt16LE(20, 6);          // version needed
    entry.writeUInt16LE(0x0808, 8);
    entry.writeUInt16LE(8, 10);
    entry.writeUInt16LE(this.time, 12);
    entry.writeUInt16LE(this.day, 14);
    entry.writeUInt32LE(f.crc, 16);
    entry.writeUInt32LE(f.packed, 20);
    entry.writeUInt32LE(f.raw, 24);
    entry.writeUInt16LE(f.name.length, 28);
    entry.writeUInt32LE(f.start, 42);    // extra, comment, disk, attrs stay 0
    this.central.push(entry, f.name);

    this.count += 1;
    this.open = null;
    if (this.offset > 0xFFFFFFFF || f.raw > 0xFFFFFFFF) throw new Error('Archive too large.');
  }

  /** A whole file in one call. */
  add(fileName, data) {
    this.begin(fileName);
    this.write(data);
    this.end();
  }

  finish() {
    if (this.open) throw new Error('A file is still open.');
    const centralSize = this.central.reduce((n, b) => n + b.length, 0);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(this.count, 8);
    end.writeUInt16LE(this.count, 10);
    end.writeUInt32LE(centralSize, 12);
    end.writeUInt32LE(this.offset, 16);
    return Buffer.concat([...this.parts, ...this.central, end]);
  }
}

/**
 * @param {Array<{ name: string, data: Buffer | string }>} files
 * @returns {Buffer} the archive
 */
function zipBuffer(files, when = new Date()) {
  const zip = new ZipWriter(when);
  for (const file of files) zip.add(file.name, file.data);
  return zip.finish();
}

module.exports = { ZipWriter, zipBuffer, crc32 };
