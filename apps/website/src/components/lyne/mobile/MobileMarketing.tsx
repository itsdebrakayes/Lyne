import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { LyneLogo } from "../LyneLogo";

const links = [
  { label: "Features", href: "/#features" },
  { label: "Pricing", href: "/#pricing" },
  { label: "For business", href: "/#partners" },
];

export function MobileMarketingNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-lyne-night/90 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between px-5 sm:px-8">
        <LyneLogo />
        <button
          type="button"
          className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-copy-navigation"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <nav
          id="mobile-copy-navigation"
          className="border-t border-white/[0.06] px-5 pb-5 pt-3 sm:px-8"
          aria-label="Mobile navigation"
        >
          <div className="flex flex-col">
            {links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setOpen(false)}
                className="flex min-h-12 items-center border-b border-white/[0.05] text-lyne-lavender/80 transition-colors hover:text-white"
              >
                {link.label}
              </a>
            ))}
            <Link
              to="/about"
              onClick={() => setOpen(false)}
              className="flex min-h-12 items-center border-b border-white/[0.05] text-lyne-lavender/80 transition-colors hover:text-white"
            >
              About
            </Link>
            <Link
              to="/join-us"
              onClick={() => setOpen(false)}
              className="flex min-h-12 items-center text-lyne-lavender/80 transition-colors hover:text-white"
            >
              Get a quote
            </Link>
            <a
              href="/#pricing"
              onClick={() => setOpen(false)}
              className="btn btn-primary mt-3 min-h-12 w-full"
            >
              Download <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </nav>
      ) : null}
    </header>
  );
}

const footerGroups = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "Pricing", href: "/#pricing" },
      { label: "Mobile App", href: "/#pricing" },
      { label: "For business", href: "/#partners" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/join-us" },
      { label: "Get a quote", href: "/join-us" },
    ],
  },
];

export function MobileMarketingFooter() {
  return (
    <footer className="border-t border-white/[0.06] bg-lyne-night/70">
      <div className="px-5 py-12 sm:px-8">
        <div className="max-w-sm">
          <LyneLogo />
          <p className="mt-4 text-sm leading-relaxed text-lyne-lavender/60">
            The simple way to run your line. See how long the wait is, hold your
            spot from your phone, and keep your day moving.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-8">
          {footerGroups.map((group) => (
            <div key={group.title}>
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-white/80">
                {group.title}
              </h4>
              {/* The anchor carries the height, not the row around it. A bare
                  inline link is only as tall as its text — 17px, against the
                  44px a fingertip actually needs — so the gap between rows was
                  doing the work of separating targets that were never big
                  enough to hit. This file only ever renders on a phone, so
                  there is no desktop case to hedge for. */}
              <ul className="flex flex-col text-sm text-lyne-lavender/60">
                {group.links.map((item) => {
                  const tap = "inline-flex min-h-[44px] items-center transition-colors hover:text-white";
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
          ))}
        </div>

        <div className="mt-10 border-t border-white/[0.06] pt-6 text-xs text-lyne-lavender/45">
          <span>© {new Date().getFullYear()} Lyne. All rights reserved.</span>
          <div className="mt-1 flex items-center gap-6">
            <Link to="/terms" className="inline-flex min-h-[44px] items-center hover:text-white">Terms</Link>
            <Link to="/privacy" className="inline-flex min-h-[44px] items-center hover:text-white">Privacy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
