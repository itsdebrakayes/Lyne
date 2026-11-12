/**
 * The two small writers every export goes through.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { csvCell, toCsv } = require('../src/utils/csv');
const { zipBuffer, crc32 } = require('../src/utils/zip');

test('a cell is quoted when it holds a comma, a quote or a line break', () => {
  assert.equal(csvCell('plain'), 'plain');
  assert.equal(csvCell('Half Way Tree, Kingston'), '"Half Way Tree, Kingston"');
  assert.equal(csvCell('said "wait"'), '"said ""wait"""');
  assert.equal(csvCell('line one\nline two'), '"line one\nline two"');
  assert.equal(csvCell(null), '');
  assert.equal(csvCell(undefined), '');
});

test('a cell that would run as a spreadsheet formula is made plain text', () => {
  // A visitor types their own name at the kiosk; an executive opens the export.
  for (const evil of ['=HYPERLINK("http://evil.example","x")', '+1+1', '-2+3', '@SUM(A1)', '\tcmd', '\rcmd']) {
    const cell = csvCell(evil);
    assert.ok(/^"?'/.test(cell), `${JSON.stringify(evil)} -> ${cell}`);
  }
  // Real numbers are not formulas: a negative figure stays a number.
  assert.equal(csvCell(-5), '-5');
  assert.equal(csvCell(12.5), '12.5');
});

test('dates, booleans and objects have one text form', () => {
  assert.equal(csvCell(new Date('2026-11-12T15:04:05Z')), '2026-11-12T15:04:05.000Z');
  assert.equal(csvCell(true), 'true');
  assert.equal(csvCell({ a: 1 }), '"{""a"":1}"');
});

test('toCsv writes a header and one CRLF row per record', () => {
  const csv = toCsv(['id', 'name'], [{ id: 1, name: 'A, B' }, { id: 2, name: null }]);
  assert.equal(csv, 'id,name\r\n1,"A, B"\r\n2,\r\n');
});

test('crc32 matches the standard check value', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xCBF43926);
});

test('the archive opens with a real unzip and returns the same bytes', (t) => {
  let unzip = true;
  try { execFileSync('unzip', ['-v'], { stdio: 'ignore' }); } catch { unzip = false; }
  if (!unzip) return t.skip('unzip is not installed here');

  const big = 'visit,minutes\r\n' + Array.from({ length: 20000 }, (_, i) => `v${i},${i % 60}`).join('\r\n');
  const files = [
    { name: 'README.txt', data: 'Héllo — yours.' },
    { name: 'visits.csv', data: big },
    { name: 'empty.csv', data: '' },
  ];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lyne-zip-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const archive = path.join(dir, 'export.zip');
  fs.writeFileSync(archive, zipBuffer(files));

  execFileSync('unzip', ['-t', archive], { stdio: 'ignore' });        // integrity (CRCs)
  execFileSync('unzip', ['-o', '-q', archive, '-d', path.join(dir, 'out')]);
  for (const f of files) {
    assert.equal(fs.readFileSync(path.join(dir, 'out', f.name), 'utf8'), f.data, f.name);
  }
});
