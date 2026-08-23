import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { LyneLogo } from "./LyneLogo";

const links = [
  { label: "Features", href: "/#features" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Partners", href: "/#partners" },
];

export function MarketingNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-lyne-night/70 backdrop-blur-xl">
      <div className="lux-container flex h-16 items-center justify-between">
        <LyneLogo />

        <nav className="hidden items-center gap-8 text-sm text-lyne-lavender/70 md:flex">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="transition-colors hover:text-white"
            >
              {l.label}
            </a>
          ))}
          <Link to="/about" className="transition-colors hover:text-white">
            About
          </Link>
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link to="/join-us" className="text-sm font-medium text-lyne-lavender/70 transition-colors hover:text-white">
            Get a quote
          </Link>
          <a href="/#pricing" className="btn btn-primary text-sm">
            Download <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>

        {/* 44x44 minimum: this was p-2 around a 20px icon, so 38x38 — under the
            touch target every mobile guideline sets, and the one place on this
            site somebody on a phone MUST hit to navigate at all.
            aria-expanded because "Menu" alone never tells a screen reader
            whether the thing is open. */}
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-nav"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div id="mobile-nav" className="border-t border-white/[0.06] md:hidden">
          <div className="lux-container flex flex-col gap-1 py-4">
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                onClick={() => setOpen(false)}
                className="py-2.5 text-lyne-lavender/80 hover:text-white"
              >
                {l.label}
              </a>
            ))}
            <Link to="/about" onClick={() => setOpen(false)} className="py-2.5 text-lyne-lavender/80 hover:text-white">
              About
            </Link>
            <Link to="/join-us" onClick={() => setOpen(false)} className="py-2.5 text-lyne-lavender/80 hover:text-white">
              Get a quote
            </Link>
            <a href="/#pricing" onClick={() => setOpen(false)} className="btn btn-primary mt-2">
              Download
            </a>
          </div>
        </div>
      )}
    </header>
  );
}

const footerCols: Array<{ title: string; items: Array<{ label: string; href: string }> }> = [
  {
    title: "Product",
    items: [
      { label: "Features", href: "/#features" },
      { label: "Pricing", href: "/#pricing" },
      { label: "Mobile App", href: "/#pricing" },
      { label: "Desktop App", href: "/#partners" },
    ],
  },
  {
    title: "Company",
    items: [
      { label: "About", href: "/about" },
      { label: "Partners", href: "/#partners" },
      { label: "Contact", href: "/join-us" },
    ],
  },
  {
    title: "Resources",
    items: [
      { label: "Get a quote", href: "/join-us" },
      { label: "How it works", href: "/#features" },
      { label: "Contact support", href: "/join-us" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-white/[0.06] bg-lyne-night/60">
      <div className="lux-container py-16">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="max-w-xs">
            <LyneLogo />
            <p className="mt-4 text-sm leading-relaxed text-lyne-lavender/60">
              The calm queue layer for modern businesses. Live wait times,
              QR check-in, and dashboards built for the people who run the day.
            </p>
          </div>
          {footerCols.map((col) => (
            <FooterCol key={col.title} title={col.title} items={col.items} />
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-3 border-t border-white/[0.06] pt-6 text-xs text-lyne-lavender/45 sm:flex-row">
          <span>© {new Date().getFullYear()} Lyne. All rights reserved.</span>
          <div className="flex gap-6">
            {/* These pointed at /about until 21 Aug 2026 — the site advertised
                three legal pages and delivered a marketing page. Security has
                no page of its own, so it is not claimed; the security
                commitments live in the Privacy Policy. */}
            <Link to="/terms" className="hover:text-white">Terms</Link>
            <Link to="/privacy" className="hover:text-white">Privacy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; href: string }>;
}) {
  return (
    <div>
      <h4 className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-white/80">
        {title}
      </h4>
      <ul className="space-y-2.5 text-sm text-lyne-lavender/55">
        {items.map((item) => (
          <li key={item.label}>
            {item.href.startsWith("/#") ? (
              <a href={item.href} className="transition-colors hover:text-white">{item.label}</a>
            ) : (
              <Link to={item.href} className="transition-colors hover:text-white">{item.label}</Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
