import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Top padding for a screen's scroll content: the device's real safe-area top
 * inset plus a small design gap — the correct replacement for the old
 * hardcoded ~66px, which was too tight on a Dynamic Island and too loose on
 * a device with no notch. `gap` is the space you want BELOW the safe area.
 */
export function useTopPad(gap = 16): number {
  const insets = useSafeAreaInsets();
  return insets.top + gap;
}

/**
 * Bottom padding that clears the home-indicator / gesture bar. Pass the design
 * gap you want above it; on devices without a bottom inset this is just `gap`.
 */
export function useBottomPad(gap = 0): number {
  const insets = useSafeAreaInsets();
  return insets.bottom + gap;
}

/**
 * How far bottom-anchored UI must rise on Android to clear the system nav bar.
 *
 * Every bottom value in the app (the tab bar at 24, sticky footers at 28-30,
 * sheets padded 34, scroll ends at 150) was tuned on iPhone, where the home
 * indicator sits in the bottom 34pt and a bar at 24 deliberately overlaps it.
 * Expo 54 draws Android edge to edge, so the 48dp three-button bar now covers
 * that same strip, and it does not tolerate overlap the way a gesture line does.
 *
 * iOS returns 0, so nothing there moves. Android returns the real inset minus
 * the 12pt the iPhone layout already leaves clear: 36 with three buttons, about
 * 12 with gesture navigation, never negative. Add it to bottom offsets,
 * paddingBottom on scroll content and sticky footers, and sheet padding.
 */
export function useNavBarLift(): number {
  const { bottom } = useSafeAreaInsets();
  if (Platform.OS !== 'android') return 0;
  return Math.max(0, bottom - 12);
}

export { useSafeAreaInsets };
