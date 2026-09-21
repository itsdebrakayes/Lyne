import { useState } from "react";
import { Link } from "react-router-dom";
import { LEGAL_ENTITY } from "@/lib/legalEntity";
import { INDEPENDENCE_DISCLAIMER } from "@/lib/independence";
import { CookieSettingsLink } from "@/components/lyne/CookieConsent";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { LyneLogo } from "./LyneLogo";

const links = [
  { label: "Features", href: "/#features" },
  { label: "Pricing", href: "/#pricing" },
  { label: "For business", href: "/#partners" },
  // In the nav as well as the footer. Somebody checking who they are handing
  // their identification to should not have to scroll a marketing page to the
  // bottom to find out — and a procurement reviewer looks for these first.
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
];

export function MarketingNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-lyne-night/70 backdrop-blur-xl">
      <div className="lux-container flex h-16 items-center justify-between">
        <LyneLogo />

        <nav aria-label="Main" className="hidden items-center gap-8 text-sm text-lyne-lavender/70 md:flex">
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
      { label: "Desktop App", href: "/download" },
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
              The simple way to run your line. See how long the wait is,
              hold your spot from your phone, and keep your day moving.
            </p>
          </div>
          {footerCols.map((col) => (
            <FooterCol key={col.title} title={col.title} items={col.items} />
          ))}
        </div>

        {/* Who you are actually dealing with.
            A trading name and an email are not enough to identify a counterparty,
            and a business selling subscriptions to public bodies will be asked for
            exactly this in procurement. It is also the honest answer to "who do I
            complain to". Sourced from legalEntity.ts so the policies and the
            footer can never drift apart. */}
        <div className="mt-14 border-t border-white/[0.06] pt-6 text-xs leading-relaxed text-lyne-lavender/45">
          <p>
            <span className="font-semibold text-lyne-lavender/70">{LEGAL_ENTITY.registeredName}</span>
            {" — "}registered in Jamaica under the Registration of Business Names Act,
            registration number {LEGAL_ENTITY.businessRegistrationNumber}. Operated as a sole trader.
          </p>
          <p className="mt-1">
            {LEGAL_ENTITY.correspondenceAddress} ·{" "}
            <a href={`mailto:${LEGAL_ENTITY.supportEmail}`} className="hover:text-white">
              {LEGAL_ENTITY.supportEmail}
            </a>
          </p>
          <p className="mt-1">{INDEPENDENCE_DISCLAIMER}</p>
        </div>

        <div className="mt-6 flex flex-col items-center justify-between gap-3 border-t border-white/[0.06] pt-6 text-xs text-lyne-lavender/45 sm:flex-row">
          <span>© {new Date().getFullYear()} Lyne. All rights reserved.</span>
          <nav aria-label="Legal" className="flex flex-wrap items-center justify-center gap-x-6">
            {/* These pointed at /about until 21 Aug 2026 — the site advertised
                three legal pages and delivered a marketing page. Security has
                no page of its own, so it is not claimed; the security
                commitments live in the Privacy Policy. */}
            <Link to="/terms" className="inline-flex min-h-[44px] items-center hover:text-white sm:min-h-0">Terms</Link>
            <Link to="/privacy" className="inline-flex min-h-[44px] items-center hover:text-white sm:min-h-0">Privacy</Link>
            <Link to="/cookies" className="inline-flex min-h-[44px] items-center hover:text-white sm:min-h-0">Cookies</Link>
            <Link to="/refunds" className="inline-flex min-h-[44px] items-center hover:text-white sm:min-h-0">Refunds</Link>
            {/* Withdrawing consent has to be as easy as giving it, which means
                a control in reach from every page rather than a browser setting. */}
            <CookieSettingsLink className="inline-flex min-h-[44px] items-center hover:text-white sm:min-h-0" />
          </nav>
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
      {/* A bare inline link is only as tall as its text — 17px here, against a
          44px guideline. On a phone that is a miss waiting to happen, so the
          anchor itself carries the height rather than the row around it: the
          whole target is tappable, not just the glyphs. Pointer users do not
          need it, so it collapses back to the tighter rhythm from sm up. */}
      <ul className="flex flex-col gap-0.5 text-sm text-lyne-lavender/55 sm:gap-2.5">
        {items.map((item) => {
          const tap = "inline-flex min-h-[44px] items-center transition-colors hover:text-white sm:min-h-0";
          return (
            <li key={item.label}>
              {item.href.startsWith("/#") ? (
                <a href={item.href} className={tap}>{item.label}</a>
              ) : (
                <Link to={item.href} className={tap}>{item.label}</Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
