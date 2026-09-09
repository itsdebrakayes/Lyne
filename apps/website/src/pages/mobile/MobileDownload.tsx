/**
 * Download, on a phone.
 *
 * Somebody reading this on a phone almost certainly cannot install anything
 * from it — the console runs on a Windows or Mac terminal in a branch. So the
 * phone version leads with that, gives them a way to send the link to the
 * machine that matters, and keeps the same gate and the same warnings as the
 * desktop page rather than a summarised version of them.
 */
import * as React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Copy, Laptop, Lock, ShieldAlert } from "lucide-react";
import { MobileMarketingNav, MobileMarketingFooter } from "@/components/lyne/mobile/MobileMarketing";
import {
  anyDesktopBuildAvailable, desktopBuilds, desktopReleased, desktopSigned, desktopVersion,
} from "@/lib/desktopRelease";

const MobileDownload = () => {
  const [copied, setCopied] = React.useState(false);

  const copyLink = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Clipboard blocked — the address bar is still right there. */
    }
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-lyne-night text-white">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 right-[-10%] h-[520px] w-[520px] rounded-full bg-lyne-purple/20 blur-[140px]" />
        <div className="absolute left-[-15%] top-[40%] h-[460px] w-[460px] rounded-full bg-lyne-violet/25 blur-[150px]" />
      </div>

      <MobileMarketingNav />

      <div className="pb-16 pt-12 sm:pb-20 sm:pt-16">
        <div className="lux-container space-y-10 sm:space-y-12">

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mx-auto max-w-2xl text-center"
          >
            <h1 className="text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
              Lyne Admin for <span className="serif accent-text">desktop.</span>
            </h1>
            <p className="mt-4 text-base text-lyne-lavender/70">
              The console your staff run the line from. It installs on a Windows
              or Mac computer — not on a phone.
            </p>
            {desktopVersion ? (
              <p className="mt-3 text-sm text-lyne-lavender/45">
                Version {desktopVersion}
                {desktopReleased ? ` · released ${desktopReleased}` : null}
              </p>
            ) : null}
          </motion.div>

          {/* Open it on the machine you are installing on. */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="rounded-2xl border border-white/[0.10] bg-white/[0.03] p-5"
          >
            <div className="flex gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.05] text-lyne-lavender">
                <Laptop className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h2 className="font-semibold leading-tight">Open this on that computer</h2>
                <p className="mt-2 text-sm leading-relaxed text-lyne-lavender/65">
                  Send yourself the link and finish on the machine the console
                  will live on.
                </p>
                <button
                  type="button"
                  onClick={copyLink}
                  className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.05] px-4 text-sm font-medium transition-colors hover:border-lyne-purple"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Link copied" : "Copy this link"}
                </button>
              </div>
            </div>
          </motion.section>

          {/* The gate. */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="rounded-2xl border border-lyne-purple/25 bg-lyne-purple/[0.07] p-5"
          >
            <div className="flex gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.05] text-lyne-lavender">
                <Lock className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h2 className="font-semibold leading-tight">
                  You need an account from us before this does anything
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-lyne-lavender/70">
                  Anyone can install it. Every screen inside is authenticated, so
                  it opens onto a sign-in and stops there. Accounts are created by
                  us for organisations with an active agreement, one per member of
                  staff — there is no sign-up, no trial mode and no offline mode.
                </p>
                <p className="mt-2 text-sm leading-relaxed text-lyne-lavender/70">
                  If your branch is already set up, whoever arranged it has your
                  credentials.
                </p>
                <Link
                  to="/join-us"
                  className="mt-4 inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-lyne-lavender hover:text-white"
                >
                  Talk to us about your branches
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </motion.section>

          {/* Builds. */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="space-y-4"
          >
            <h2 className="text-xl font-bold tracking-tight">Builds</h2>
            <div className="space-y-3">
              {desktopBuilds.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.10] bg-white/[0.03] p-4"
                >
                  <div className="min-w-0">
                    <p className="font-medium leading-tight">{b.label}</p>
                    <p className="mt-0.5 text-sm text-lyne-lavender/55">{b.detail}</p>
                  </div>
                  {b.available ? (
                    <a
                      href={b.url}
                      download
                      className="shrink-0 rounded-xl border border-lyne-purple/40 bg-lyne-purple/15 px-3 py-2.5 text-sm font-medium"
                    >
                      {b.extension}
                    </a>
                  ) : (
                    <span className="shrink-0 text-sm text-lyne-lavender/45">Not yet</span>
                  )}
                </div>
              ))}
            </div>
            {!anyDesktopBuildAvailable ? (
              <p className="text-sm text-lyne-lavender/55">
                The installers are not published yet. If you are setting up a
                branch now, ask your Lyne contact and we will send you the build
                directly.
              </p>
            ) : null}
          </motion.section>

          {/* The OS warning, while unsigned. */}
          {!desktopSigned ? (
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="rounded-2xl border border-white/[0.10] bg-white/[0.03] p-5"
            >
              <div className="flex gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.05] text-lyne-lavender">
                  <ShieldAlert className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h2 className="font-semibold leading-tight">
                    The computer will warn you the first time
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-lyne-lavender/70">
                    Our code-signing certificate is still being issued, so the
                    operating system does not recognise the publisher yet.
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-lyne-lavender/65">
                    <strong className="text-white/85">Windows:</strong> choose More
                    info, then Run anyway.
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-lyne-lavender/65">
                    <strong className="text-white/85">macOS:</strong> right-click the
                    app and choose Open.
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-lyne-lavender/55">
                    Some managed workplaces block unrecognised software outright
                    rather than warning. If nothing happens at all, your IT policy
                    is stopping it — tell us.
                  </p>
                </div>
              </div>
            </motion.section>
          ) : null}

          {/* Not this page. */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="rounded-2xl border border-white/[0.10] bg-white/[0.03] p-5"
          >
            <h2 className="font-semibold leading-tight">This is only the desktop console</h2>
            <p className="mt-3 flex gap-2.5 text-sm leading-relaxed text-lyne-lavender/70">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-lyne-purple" />
              The app customers use to join a line comes from the App Store and
              Google Play, and needs no account from us.
            </p>
            <p className="mt-2 flex gap-2.5 text-sm leading-relaxed text-lyne-lavender/70">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-lyne-purple" />
              Lobby kiosks are set up with the branch, not downloaded here.
            </p>
          </motion.section>

        </div>
      </div>

      <MobileMarketingFooter />
    </div>
  );
};

export default MobileDownload;
