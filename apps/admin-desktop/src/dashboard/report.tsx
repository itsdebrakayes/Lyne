/**
 * report.tsx — document-style report preview + Word export.
 *
 * The preview renders as a page you can read on screen; "Download as Word"
 * exports exactly what you see. Charts are inline SVG, so before export each
 * one is redrawn to a PNG (resolving CSS custom properties, which do NOT
 * survive serialisation) and swapped in as an <img> — otherwise Word shows
 * an empty box where the graph should be.
 */
import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Download, FileText } from 'lucide-react';

/* ---------- SVG → PNG (so charts survive the export) ---------- */

const PAINT = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap',
  'stroke-linejoin', 'opacity', 'fill-opacity', 'stroke-opacity', 'font-size',
  'font-weight', 'font-family', 'text-anchor'] as const;

/** Copy resolved paint values onto the clone — var(--qa-*) won't resolve standalone. */
function inlinePaint(src: Element, dst: Element) {
  const cs = window.getComputedStyle(src);
  for (const prop of PAINT) {
    const v = cs.getPropertyValue(prop);
    if (v && v !== 'none' && v !== 'normal') dst.setAttribute(prop, v.trim());
  }
  const sk = Array.from(src.children);
  const dk = Array.from(dst.children);
  for (let i = 0; i < sk.length && i < dk.length; i++) inlinePaint(sk[i], dk[i]);
}

async function svgToPng(svg: SVGSVGElement, scale = 2): Promise<string | null> {
  try {
    const box = svg.getBoundingClientRect();
    const w = Math.max(1, Math.round(box.width));
    const h = Math.max(1, Math.round(box.height));
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('width', String(w));
    clone.setAttribute('height', String(h));
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    inlinePaint(svg, clone);

    const xml = new XMLSerializer().serializeToString(clone);
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('svg load failed'));
      i.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } catch {
    return null; // export still succeeds, just without that chart
  }
}

/** Word-friendly stylesheet — Word ignores most modern CSS, so keep it plain. */
const WORD_CSS = `
  body{font-family:Calibri,Arial,sans-serif;color:#1F3442;font-size:11pt;line-height:1.5}
  h1{font-size:22pt;margin:0 0 4pt}
  h2{font-size:14pt;margin:18pt 0 6pt;border-bottom:1px solid #D9E4EA;padding-bottom:4pt}
  .muted{color:#5A6E7D;font-size:10pt;margin:0 0 14pt}
  .blurb{color:#33475A;font-size:10.5pt;margin:6pt 0 14pt}
  table{border-collapse:collapse;width:100%;margin:6pt 0 14pt}
  th,td{border:1px solid #D9E4EA;padding:6pt 8pt;font-size:10pt;text-align:left}
  th{background:#EEF3F7;font-weight:bold}
  td.r,th.r{text-align:right}
  .kpis td{text-align:center;border:1px solid #D9E4EA}
  .kpis .v{font-size:16pt;font-weight:bold}
  .kpis .l{font-size:9pt;color:#5A6E7D}
  img{max-width:100%}
`;

/** Export the rendered report node as a Word document. */
export async function exportReportToWord(node: HTMLElement, filename: string) {
  const clone = node.cloneNode(true) as HTMLElement;

  // swap every chart for a rendered PNG
  const originals = Array.from(node.querySelectorAll('svg'));
  const copies = Array.from(clone.querySelectorAll('svg'));
  for (let i = 0; i < originals.length; i++) {
    const png = await svgToPng(originals[i] as SVGSVGElement);
    const target = copies[i];
    if (!target || !target.parentNode) continue;
    if (png) {
      const img = document.createElement('img');
      img.src = png;
      img.width = Math.round(originals[i].getBoundingClientRect().width);
      target.parentNode.replaceChild(img, target);
    } else {
      target.parentNode.removeChild(target);
    }
  }

  // drop anything that shouldn't be in a document (buttons etc.)
  clone.querySelectorAll('button,[data-noexport]').forEach((el) => el.remove());

  const html = `<!doctype html><html xmlns:o="urn:schemas-microsoft-com:office:office"
    xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8"><title>${filename}</title><style>${WORD_CSS}</style></head>
    <body>${clone.innerHTML}</body></html>`;

  const blob = new Blob(['﻿', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- preview shell ---------- */

export function ReportDoc({ title, subtitle, meta, filename, children }: {
  title: string; subtitle?: string; meta?: string; filename: string; children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const download = async () => {
    if (!ref.current) return;
    setBusy(true);
    try {
      await exportReportToWord(ref.current, filename);
      setDone(true);
      window.setTimeout(() => setDone(false), 3000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="qa-docwrap">
      <div className="qa-doctools" data-noexport>
        <span className="qa-doclabel"><FileText size={15} />Preview — this is exactly what downloads</span>
        <button type="button" className="qa-update" onClick={download} disabled={busy}>
          <Download size={16} />{busy ? 'Preparing…' : 'Download as Word'}
        </button>
        {done ? <span className="qa-docok">Downloaded</span> : null}
      </div>
      <div className="qa-page" ref={ref}>
        <h1>{title}</h1>
        {subtitle ? <p className="muted">{subtitle}</p> : null}
        {meta ? <p className="muted">{meta}</p> : null}
        {children}
      </div>
    </div>
  );
}

export function ReportSection({ heading, blurb, children }: { heading: string; blurb?: string; children?: ReactNode }) {
  return (
    <section>
      <h2>{heading}</h2>
      {blurb ? <p className="blurb">{blurb}</p> : null}
      {children}
    </section>
  );
}

export function ReportKpis({ items }: { items: Array<[string, string]> }) {
  return (
    <table className="kpis"><tbody><tr>
      {items.map(([label, value]) => (
        <td key={label}><div className="v">{value}</div><div className="l">{label}</div></td>
      ))}
    </tr></tbody></table>
  );
}

export function ReportTable({ head, rows }: { head: string[]; rows: Array<Array<string | number>> }) {
  return (
    <table>
      <thead><tr>{head.map((h, i) => <th key={h} className={i ? 'r' : ''}>{h}</th>)}</tr></thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={ri}>{r.map((c, ci) => <td key={ci} className={ci ? 'r' : ''}>{c}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}
