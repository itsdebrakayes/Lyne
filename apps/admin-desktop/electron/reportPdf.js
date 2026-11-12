/**
 * reportPdf.js — prints a report to PDF with a real contents page.
 *
 * A browser cannot say which page a heading lands on, but a chapter always starts
 * on a new page. So each part is printed alone to count its pages; their running
 * total gives every chapter's page, the {{p:id}} marks in the contents are filled
 * in, and the whole document is printed once with page numbers in the footer.
 * Offscreen, no preload, no node, no script: it only lays out a static document.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const PART_SPLIT = '<!--part-->';
const stripPageMarks = (html) => html.replace(/\{\{p:[\w-]+\}\}/g, '');
const pagesIn = (pdf) => (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

async function printReport(BrowserWindow, html) {
  const printer = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: false },
  });
  const temp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'lyne-report-')), 'report.html');
  const margins = { top: 0.6, bottom: 0.7, left: 0.6, right: 0.6 };
  const print = async (doc, options = {}) => {
    fs.writeFileSync(temp, doc, 'utf8');
    await printer.loadFile(temp);
    return printer.webContents.printToPDF({ pageSize: 'A4', printBackground: true, margins, ...options });
  };
  try {
    const pieces = html.split(PART_SPLIT);
    if (pieces.length < 3) return await print(stripPageMarks(html));

    const head = pieces[0];
    const tail = pieces[pieces.length - 1];
    const parts = pieces.slice(1, -1);
    const pageOf = new Map();
    let page = 1;
    for (const part of parts) {
      const id = (part.match(/data-part="([\w-]+)"/) || [])[1];
      if (id) pageOf.set(id, page);
      // eslint-disable-next-line no-await-in-loop
      page += pagesIn(await print(head + stripPageMarks(part) + tail));
    }
    const filled = html.replace(/\{\{p:([\w-]+)\}\}/g, (_, id) => String(pageOf.get(id) ?? ''));
    const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || 'Lyne report';
    const small = 'font-size:8px;font-family:Arial,sans-serif;color:#5A6E7D;width:100%;padding:0 42px;display:flex;justify-content:space-between';
    return await print(filled, {
      displayHeaderFooter: true,
      headerTemplate: `<div style="${small}"><span>${escapeHtml(title)}</span><span>Confidential</span></div>`,
      footerTemplate: `<div style="${small}"><span>Lyne</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
    });
  } finally {
    printer.destroy();
    fs.rmSync(path.dirname(temp), { recursive: true, force: true });
  }
}

module.exports = { printReport, stripPageMarks, pagesIn };
