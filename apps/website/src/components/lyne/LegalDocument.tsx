/**
 * LegalDocument — renders legal/*.md on the site.
 *
 * The markdown in legal/ is the single source of truth. It is imported here
 * with ?raw rather than retyped into JSX, because a Privacy Policy that exists
 * in two places WILL drift, and the version a regulator reads is the published
 * one.
 *
 * The renderer is deliberately small and handles only what these documents
 * actually use — headings, paragraphs, lists, tables, bold, links, blockquotes
 * and horizontal rules. It is not a general markdown engine and should not grow
 * into one; if a policy needs something else, the simpler fix is to write the
 * policy in the subset.
 */
import { Fragment, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { applyLegalEntity, outstandingLegalFields } from "@/lib/legalEntity";

/* ── inline formatting ────────────────────────────────────── */

/** Bold, links, and inline code. Applied to every leaf of text. */
function inline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // One pass, alternating between the three inline forms these documents use.
  // Placeholders are an alternative HERE rather than a separate pre-pass:
  // marking them first split "**... [NUMBER] ...**" and left the asterisks
  // visible on the published page.
  const pattern = /(\*\*(?:[^*]|\*(?!\*))+\*\*)|(\[[A-Z][A-Z0-9 /"'\u2014\u2013.,_-]*\])|(\[[^\]]+\]\([^)]+\))|(`[^`]+`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyPrefix}-i${i++}`;

    if (token.startsWith("**")) {
      // Recurse so a placeholder inside bold still gets its own marker.
      nodes.push(
        <strong key={key} className="font-semibold text-white">{inline(token.slice(2, -2), key)}</strong>,
      );
    } else if (/^\[[A-Z]/.test(token) && !token.includes("](")) {
      nodes.push(
        <span
          key={key}
          className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[0.92em] font-semibold text-amber-200"
          title="Still to be completed before publication"
        >
          {token}
        </span>,
      );
    } else if (token.startsWith("`")) {
      nodes.push(
        <code key={key} className="rounded bg-white/[0.08] px-1.5 py-0.5 font-mono text-[0.9em] text-lyne-lavender">
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      const label = token.slice(1, token.indexOf("]"));
      const href = token.slice(token.indexOf("(") + 1, -1);
      const internal = href.startsWith("/") || href.startsWith("#");
      nodes.push(
        <a
          key={key}
          href={href}
          className="text-lyne-lavender underline decoration-lyne-lavender/40 underline-offset-2 hover:text-white"
          {...(internal ? {} : { target: "_blank", rel: "noreferrer noopener" })}
        >
          {label}
        </a>,
      );
    }
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/**
 * Placeholder marking now happens inside inline(), so this is a thin alias kept
 * for readability at the call sites.
 */
function markPlaceholders(text: string, keyPrefix: string): ReactNode[] {
  return inline(text, keyPrefix);
}

const splitRow = (line: string) =>
  line.replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());

/* ── block renderer ───────────────────────────────────────── */

function render(markdown: string): ReactNode[] {
  const lines = markdown.split("\n");
  const out: ReactNode[] = [];
  let i = 0;

  const flushParagraph = (buffer: string[], key: string) => {
    if (!buffer.length) return;
    // Joined, not line-broken: a single newline is a soft break in markdown, and
    // rendering each source line separately split every **bold phrase that
    // wrapped**, leaving asterisks on the published page. Where a document
    // genuinely wants separate lines it uses separate paragraphs.
    out.push(
      <p key={key} className="mt-4 text-[15px] leading-[1.75] text-lyne-lavender/75">
        {markPlaceholders(buffer.join(" "), key)}
      </p>,
    );
    buffer.length = 0;
  };

  let paragraph: string[] = [];

  while (i < lines.length) {
    const line = lines[i];
    const key = `l${i}`;

    // table — header, separator, then rows
    if (line.trim().startsWith("|") && lines[i + 1]?.includes("---")) {
      flushParagraph(paragraph, `${key}-pre`);
      const headers = splitRow(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(splitRow(lines[i]));
        i += 1;
      }
      out.push(
        // Wide tables scroll inside their own container so the page body never does.
        <div key={key} className="mt-6 overflow-x-auto rounded-xl border border-white/[0.08]">
          <table className="w-full min-w-[520px] border-collapse text-left text-sm">
            <thead>
              <tr className="bg-white/[0.04]">
                {headers.map((h, hi) => (
                  <th key={hi} className="border-b border-white/[0.08] px-4 py-3 font-semibold text-white">
                    {markPlaceholders(h, `${key}-h${hi}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="align-top">
                  {row.map((cell, ci) => (
                    <td key={ci} className="border-b border-white/[0.05] px-4 py-3 text-lyne-lavender/75">
                      {markPlaceholders(cell, `${key}-r${ri}c${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // bullet list
    if (/^\s*[-*]\s+/.test(line)) {
      flushParagraph(paragraph, `${key}-pre`);
      const items: string[] = [];
      while (i < lines.length && (/^\s*[-*]\s+/.test(lines[i]) || (items.length && /^\s{2,}\S/.test(lines[i])))) {
        if (/^\s*[-*]\s+/.test(lines[i])) items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        else items[items.length - 1] += " " + lines[i].trim(); // wrapped continuation
        i += 1;
      }
      out.push(
        <ul key={key} className="mt-4 space-y-2 pl-5">
          {items.map((item, ii) => (
            <li key={ii} className="list-disc text-[15px] leading-[1.7] text-lyne-lavender/75 marker:text-lyne-lavender/40">
              {markPlaceholders(item, `${key}-li${ii}`)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    // numbered list
    if (/^\s*\d+\.\s+/.test(line)) {
      flushParagraph(paragraph, `${key}-pre`);
      const items: string[] = [];
      while (i < lines.length && (/^\s*\d+\.\s+/.test(lines[i]) || (items.length && /^\s{2,}\S/.test(lines[i])))) {
        if (/^\s*\d+\.\s+/.test(lines[i])) items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        else items[items.length - 1] += " " + lines[i].trim();
        i += 1;
      }
      out.push(
        <ol key={key} className="mt-4 space-y-2 pl-5">
          {items.map((item, ii) => (
            <li key={ii} className="list-decimal text-[15px] leading-[1.7] text-lyne-lavender/75 marker:text-lyne-lavender/40">
              {markPlaceholders(item, `${key}-oi${ii}`)}
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    // blockquote — used for the "requires legal review" notice
    if (line.trim().startsWith(">")) {
      flushParagraph(paragraph, `${key}-pre`);
      const body: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        body.push(lines[i].replace(/^\s*>\s?/, ""));
        i += 1;
      }
      out.push(
        <blockquote key={key} className="mt-6 rounded-xl border-l-2 border-amber-400/50 bg-amber-400/[0.07] px-5 py-4 text-[15px] leading-[1.7] text-amber-100/90">
          {markPlaceholders(body.join(" "), key)}
        </blockquote>,
      );
      continue;
    }

    if (/^#{1,4}\s/.test(line)) {
      flushParagraph(paragraph, `${key}-pre`);
      const level = line.match(/^#+/)![0].length;
      const text = line.replace(/^#+\s+/, "");
      const styles: Record<number, string> = {
        1: "mt-0 text-3xl font-bold tracking-tight text-white sm:text-4xl",
        2: "mt-12 border-t border-white/[0.07] pt-8 text-xl font-bold text-white sm:text-2xl",
        3: "mt-8 text-lg font-semibold text-white",
        4: "mt-6 text-base font-semibold text-white",
      };
      const Tag = (`h${Math.min(level, 4)}` as unknown) as "h1";
      out.push(<Tag key={key} className={styles[level] ?? styles[4]}>{markPlaceholders(text, key)}</Tag>);
      i += 1;
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      flushParagraph(paragraph, `${key}-pre`);
      i += 1;
      continue; // the <h2> rule already provides the separation
    }

    if (!line.trim()) {
      flushParagraph(paragraph, key);
      i += 1;
      continue;
    }

    paragraph.push(line.trim());
    i += 1;
  }
  flushParagraph(paragraph, "tail");
  return out;
}

/* ── page ─────────────────────────────────────────────────── */

export function LegalDocument({ markdown }: { markdown: string }) {
  const outstanding = outstandingLegalFields();
  const body = render(applyLegalEntity(markdown));

  return (
    <article className="mx-auto max-w-3xl">
      {/* Shown only while identity fields are blank, and clears itself when they
          are filled. Publishing a policy that quietly reads "[ADDRESS]" is worse
          than one that says out loud it is not finished. */}
      {outstanding.length > 0 ? (
        <div className="mb-10 flex gap-4 rounded-2xl border border-amber-400/25 bg-amber-400/[0.08] p-5">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-none text-amber-300" />
          <div className="text-sm leading-relaxed text-amber-100/90">
            <p className="font-semibold text-amber-100">This document is not final.</p>
            <p className="mt-1">
              It is pending review by a Jamaican attorney, and {outstanding.length}{" "}
              {outstanding.length === 1 ? "detail is" : "details are"} still to be confirmed:{" "}
              {outstanding.join(", ")}. Anything still outstanding is highlighted below.
            </p>
          </div>
        </div>
      ) : null}
      {body}
    </article>
  );
}

export default LegalDocument;
