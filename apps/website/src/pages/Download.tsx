/**
 * Download — the desktop admin console, and the fact that installing it is not
 * the same as being able to use it.
 *
 * This page is for one audience: the IT officer at a branch who has been told
 * to put Lyne Admin on a terminal. It is not a marketing page and it does not
 * try to sell anything — the person reading it has already been sold to.
 *
 * The gate is stated in the second thing on the page, not the last. The app is
 * authenticated end to end: anyone can download and install it, and without
 * credentials issued under an active agreement it opens onto a sign-in screen
 * and stops. Saying that late would waste somebody's afternoon and make us look
 * like we were hiding it; saying it early is just accurate.
 */
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Apple, ArrowRight, Check, Download as DownloadIcon, HardDrive,
  Lock, Monitor, ShieldAlert,
} from "lucide-react";
import { MarketingNav, MarketingFooter } from "@/components/lyne/Marketing";
import {
  anyDesktopBuildAvailable, desktopBuilds, desktopReleased, desktopSigned,
  desktopVersion, guessPlatform, type DesktopBuild,
} from "@/lib/desktopRelease";

const REQUIREMENTS = [
  { icon: Monitor, label: "Windows 10 or 11 (64-bit), or macOS 12 Monterey and later" },
  { icon: HardDrive, label: "500 MB free disk space, 4 GB RAM" },
  { icon: DownloadIcon, label: "A steady internet connection — the console reads live queue data" },
];

const AFTER_INSTALL = [
  "Accept the licence, choose where downloaded reports are saved, and decide whether Lyne starts with the machine. Takes under a minute and runs once.",
  "Sign in with the credentials we issued for your branch. Each member of staff gets their own — they are not shared.",
  "The console opens on the role that account holds: a line desk, a supervisor's board, a manager's branch, or the executive view.",
];

function PlatformIcon({ id }: { id: DesktopBuild["id"] }) {
  const Glyph = id === "windows" ? Monitor : Apple;
  return <Glyph className="h-5 w-5" />;
}

function BuildCard({ build, primary }: { build: DesktopBuild; primary: boolean }) {
  const base =
    "flex h-full flex-col rounded-2xl border p-6 transition-colors " +
    (primary
      ? "border-lyne-purple/40 bg-lyne-purple/[0.07]"
      : "border-white/[0.10] bg-white/[0.03]");

  return (
    <div className={base}>
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[0.05] text-lyne-lavender">
          <PlatformIcon id={build.id} />
        </span>
        <div className="min-w-0">
          <h3 className="font-semibold leading-tight">{build.label}</h3>
          <p className="text-sm text-lyne-lavender/55">{build.detail}</p>
        </div>
      </div>

      {primary ? (
        <span className="mt-4 inline-flex w-fit items-center rounded-full border border-lyne-purple/40 bg-lyne-purple/15 px-2.5 py-1 text-[11px] font-medium text-lyne-lavender">
          Looks like your computer
        </span>
      ) : null}

      <div className="mt-auto pt-6">
        {build.available ? (
          <a
            href={build.url}
            className="btn btn-primary inline-flex w-full items-center justify-center gap-2 text-sm"
            /* The browser names the file from the URL; this only asks it to
               download rather than navigate. */
            download
          >
            <DownloadIcon className="h-4 w-4" />
            Download {build.extension}
          </a>
        ) : (
          /* No URL configured. A disabled control that says why, rather than a
             link that 404s in front of somebody's IT department. */
          <div className="rounded-xl border border-white/[0.10] bg-white/[0.02] px-4 py-3 text-center text-sm text-lyne-lavender/50">
            Not published yet
          </div>
        )}
      </div>
    </div>
  );
}

const Download = () => {
  const guessed = guessPlatform();

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-lyne-night text-white">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 right-[-10%] h-[520px] w-[520px] rounded-full bg-lyne-purple/20 blur-[140px]" />
        <div className="absolute left-[-15%] top-[45%] h-[460px] w-[460px] rounded-full bg-lyne-violet/25 blur-[150px]" />
      </div>

      <MarketingNav />

      <main className="pb-24 pt-20">
        <div className="lux-container space-y-14">

          {/* ── what this is ─────────────────────────────────────────── */}
          <motion.header
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mx-auto max-w-3xl text-center"
          >
            <h1 className="text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
              Lyne Admin for <span className="serif accent-text">desktop.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-lyne-lavender/70">
              The console your staff run the line from — calling the next person,
              moving people between counters, and watching the branch in real time.
            </p>
            {desktopVersion ? (
              <p className="mt-4 text-sm text-lyne-lavender/45">
                Version {desktopVersion}
                {desktopReleased ? ` · released ${desktopReleased}` : null}
              </p>
            ) : null}
          </motion.header>

          {/* ── the gate, said early ─────────────────────────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="mx-auto max-w-3xl rounded-2xl border border-lyne-purple/25 bg-lyne-purple/[0.07] p-6 sm:p-8"
          >
            <div className="flex gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.05] text-lyne-lavender">
                <Lock className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-xl font-semibold tracking-tight">
                  You need an account from us before this does anything
                </h2>
                <p className="mt-3 text-[15px] leading-relaxed text-lyne-lavender/70">
                  Anyone can download and install the app. Every screen inside it
                  is authenticated, so it opens onto a sign-in and stops there.
                  Accounts are created by us for organisations with an active
                  agreement, one per member of staff — there is no sign-up,
                  no trial mode and no offline mode.
                </p>
                <p className="mt-3 text-[15px] leading-relaxed text-lyne-lavender/70">
                  If your branch is already set up with Lyne, whoever arranged it
                  has your credentials. If not, the app will install and you will
                  not be able to get past the first screen.
                </p>
                <Link
                  to="/join-us"
                  className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-lyne-lavender transition-colors hover:text-white"
                >
                  Talk to us about your branches
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </motion.section>

          {/* ── the builds ───────────────────────────────────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="space-y-6"
          >
            <h2 className="text-2xl font-bold tracking-tight">Choose your computer</h2>

            <div className="grid gap-5 md:grid-cols-3">
              {desktopBuilds.map((b) => (
                <BuildCard key={b.id} build={b} primary={b.id === guessed} />
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

          {/* ── the OS warning, while the build is unsigned ──────────── */}
          {!desktopSigned ? (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="rounded-2xl border border-white/[0.10] bg-white/[0.03] p-6 sm:p-8"
            >
              <div className="flex gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.05] text-lyne-lavender">
                  <ShieldAlert className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">
                    Your computer will warn you the first time
                  </h2>
                  <p className="mt-3 text-[15px] leading-relaxed text-lyne-lavender/70">
                    Our code-signing certificate is still being issued, so the
                    operating system does not yet recognise the publisher. The app
                    is unaffected — this is about the certificate, not the software.
                  </p>

                  <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    <div>
                      <h3 className="text-sm font-semibold">On Windows</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-lyne-lavender/65">
                        A blue box says <em>Windows protected your PC</em>. Choose{" "}
                        <strong className="text-white/85">More info</strong>, then{" "}
                        <strong className="text-white/85">Run anyway</strong>.
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">On macOS</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-lyne-lavender/65">
                        macOS refuses it on a double-click. Right-click the app and
                        choose <strong className="text-white/85">Open</strong>, then
                        confirm.
                      </p>
                    </div>
                  </div>

                  <p className="mt-5 text-sm leading-relaxed text-lyne-lavender/55">
                    Some managed workplaces block unrecognised software outright
                    rather than warning about it. If nothing happens when you run
                    the installer, your IT policy is stopping it — tell us and we
                    will work with whoever administers your machines.
                  </p>
                </div>
              </div>
            </motion.section>
          ) : null}

          {/* ── requirements and what happens next ───────────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="grid gap-5 lg:grid-cols-2"
          >
            <div className="rounded-2xl border border-white/[0.10] bg-white/[0.03] p-6 sm:p-8">
              <h2 className="text-xl font-semibold tracking-tight">What it needs</h2>
              <ul className="mt-5 space-y-4">
                {REQUIREMENTS.map(({ icon: Icon, label }) => (
                  <li key={label} className="flex gap-3 text-sm leading-relaxed text-lyne-lavender/70">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-lyne-purple" />
                    {label}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-white/[0.10] bg-white/[0.03] p-6 sm:p-8">
              <h2 className="text-xl font-semibold tracking-tight">After it installs</h2>
              <ol className="mt-5 space-y-4">
                {AFTER_INSTALL.map((step, i) => (
                  <li key={step} className="flex gap-3 text-sm leading-relaxed text-lyne-lavender/70">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-white/15 bg-white/[0.05] text-[11px] font-semibold text-lyne-lavender">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </motion.section>

          {/* ── kiosks and phones are not this ───────────────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="rounded-2xl border border-white/[0.10] bg-white/[0.03] p-6 sm:p-8"
          >
            <h2 className="text-xl font-semibold tracking-tight">This page is only the desktop console</h2>
            <div className="mt-4 space-y-2.5">
              <p className="flex gap-3 text-sm leading-relaxed text-lyne-lavender/70">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-lyne-purple" />
                The app your customers use to join a line comes from the App Store
                and Google Play, and needs no account from us.
              </p>
              <p className="flex gap-3 text-sm leading-relaxed text-lyne-lavender/70">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-lyne-purple" />
                Lobby kiosks are set up with the branch, not downloaded here.
              </p>
            </div>
          </motion.section>

        </div>
      </main>

      <MarketingFooter />
    </div>
  );
};

export default Download;
