/**
 * Where the desktop installers live, and whether they exist yet.
 *
 * The download page is real before the artefacts are. Hard-coding a URL that
 * 404s is worse than saying nothing: somebody hands the link to a branch's IT
 * officer, it fails in front of them, and the thing that looks broken is us.
 *
 * So each build is described here and its URL comes from the environment. A
 * platform with no URL configured renders as "not published yet" rather than as
 * a button that does not work. Set these at build time when the installers are
 * hosted:
 *
 *   VITE_DESKTOP_VERSION          e.g. 1.0.0
 *   VITE_DESKTOP_RELEASED         e.g. 2026-09-15
 *   VITE_DESKTOP_WIN_URL          .exe  (NSIS installer)
 *   VITE_DESKTOP_MAC_ARM_URL      .dmg  (Apple silicon)
 *   VITE_DESKTOP_MAC_INTEL_URL    .dmg  (Intel)
 *
 * VITE_DESKTOP_SIGNED is a separate switch on purpose. Until the certificate
 * is issued the installers are unsigned, and the page has to warn people about
 * the operating system's warning. Flipping one variable removes that whole
 * section rather than leaving the site telling a stale story.
 */

const env = import.meta.env;

const clean = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export type DesktopPlatform = 'windows' | 'mac-arm' | 'mac-intel';

export interface DesktopBuild {
  id: DesktopPlatform;
  label: string;
  detail: string;
  extension: string;
  url: string;
  /** False when no URL is configured — render as pending, never as a link. */
  available: boolean;
}

export const desktopVersion = clean(env.VITE_DESKTOP_VERSION);
export const desktopReleased = clean(env.VITE_DESKTOP_RELEASED);

/** True only when the build was signed with a real certificate. */
export const desktopSigned = clean(env.VITE_DESKTOP_SIGNED).toLowerCase() === 'true';

function build(
  id: DesktopPlatform,
  label: string,
  detail: string,
  extension: string,
  url: string,
): DesktopBuild {
  return { id, label, detail, extension, url, available: Boolean(url) };
}

export const desktopBuilds: DesktopBuild[] = [
  build('windows', 'Windows', 'Windows 10 or 11, 64-bit', '.exe', clean(env.VITE_DESKTOP_WIN_URL)),
  build('mac-arm', 'macOS — Apple silicon', 'M1 and newer', '.dmg', clean(env.VITE_DESKTOP_MAC_ARM_URL)),
  build('mac-intel', 'macOS — Intel', 'Pre-2020 Macs', '.dmg', clean(env.VITE_DESKTOP_MAC_INTEL_URL)),
];

export const anyDesktopBuildAvailable = desktopBuilds.some((b) => b.available);

/**
 * A guess at which build this visitor wants, used only to put one card first.
 *
 * A guess, so it never hides the others — somebody downloads on their laptop to
 * install on the terminal in the branch, and that is a normal thing to do.
 */
export function guessPlatform(): DesktopPlatform | null {
  if (typeof navigator === 'undefined') return null;
  const ua = `${navigator.userAgent} ${navigator.platform || ''}`.toLowerCase();
  if (ua.includes('win')) return 'windows';
  if (ua.includes('mac')) {
    /* Apple silicon does not announce itself in the user agent, so this is the
       usual approximation and it is allowed to be wrong — both Mac cards are
       on the page either way. */
    const cores = typeof navigator.hardwareConcurrency === 'number' ? navigator.hardwareConcurrency : 0;
    return cores >= 8 ? 'mac-arm' : 'mac-intel';
  }
  return null;
}
