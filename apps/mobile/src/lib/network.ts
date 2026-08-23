/**
 * network — connectivity awareness for the app and for React Query.
 *
 * The app had none of this. Offline, every request simply failed and screens
 * showed their generic error, which is exactly the "weak/offline connection"
 * case the device test matrix calls out: state should be preserved, and retry
 * and last-updated information should be clear.
 *
 * Two pieces:
 *   • `startNetworkWatch` wires React Query's onlineManager to the real device
 *     state, so queries pause while offline and refetch by themselves when the
 *     connection comes back, instead of burning retries into a dead radio.
 *   • `useIsOffline` drives the banner.
 */
import { useEffect, useState } from 'react';
import * as Network from 'expo-network';
import { onlineManager } from '@tanstack/react-query';

function isOnline(state: Network.NetworkState | undefined) {
  if (!state) return true;
  // `isInternetReachable` is the honest signal — a device can be joined to Wi-Fi
  // that has no route out. It is undefined while the check is in flight, and
  // treating that as offline would flash the banner on every launch.
  if (state.isInternetReachable === false) return false;
  return state.isConnected !== false;
}

/**
 * Point React Query at the device's real connectivity. Call once, at startup.
 * Returns an unsubscribe function.
 */
export function startNetworkWatch() {
  Network.getNetworkStateAsync()
    .then((state) => onlineManager.setOnline(isOnline(state)))
    .catch(() => onlineManager.setOnline(true));

  const subscription = Network.addNetworkStateListener((state) => {
    onlineManager.setOnline(isOnline(state));
  });
  return () => subscription.remove();
}

/** True when the device has no usable connection. */
export function useIsOffline() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Network.getNetworkStateAsync()
      .then((state) => { if (!cancelled) setOffline(!isOnline(state)); })
      .catch(() => { if (!cancelled) setOffline(false); });

    const subscription = Network.addNetworkStateListener((state) => {
      if (!cancelled) setOffline(!isOnline(state));
    });

    return () => { cancelled = true; subscription.remove(); };
  }, []);

  return offline;
}

/**
 * "Updated 2 minutes ago" — relative, and plain enough for a customer.
 * Freshness matters more than usual offline, because the number on screen may
 * be the last one we managed to fetch rather than the current one.
 */
export function lastUpdatedLabel(timestamp: number | undefined) {
  if (!timestamp) return 'Not updated yet';
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 45) return 'Updated just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `Updated ${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  return `Updated ${hours} hour${hours === 1 ? '' : 's'} ago`;
}
