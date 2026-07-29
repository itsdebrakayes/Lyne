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

export { useSafeAreaInsets };
