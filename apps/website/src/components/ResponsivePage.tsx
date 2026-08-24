import { useSyncExternalStore, type ReactNode } from "react";

// Phones and compact tablets always use the dedicated mobile copy. Larger
// tablets also switch to it in portrait, then return to desktop in landscape.
const MOBILE_LAYOUT_QUERY =
  "(max-width: 1099px), (orientation: portrait) and (max-width: 1366px)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(MOBILE_LAYOUT_QUERY);
  media.addEventListener("change", onChange);
  window.addEventListener("orientationchange", onChange);

  return () => {
    media.removeEventListener("change", onChange);
    window.removeEventListener("orientationchange", onChange);
  };
}
function getSnapshot() {
  return window.matchMedia(MOBILE_LAYOUT_QUERY).matches;
}

function getServerSnapshot() {
  return false;
}

export function ResponsivePage({
  desktop,
  mobile,
}: {
  desktop: ReactNode;
  mobile: ReactNode;
}) {
  const useMobileCopy = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  return useMobileCopy ? mobile : desktop;
}
