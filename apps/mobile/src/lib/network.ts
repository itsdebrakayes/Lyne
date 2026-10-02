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

/**
 * The last time a request to our API actually succeeded.
 *
 * This exists because the operating system's answer is not always true. On the
 * iOS Simulator `isInternetReachable` reports false on a device that is plainly
 * online — measured directly: the banner was up while /api/queues/mine and
 * /api/branches were returning 200. Trusting that one signal told people their
 * connection was gone while the app was actively talking to the server.
 *
 * A reachability probe is a guess about whether traffic would work. A request
 * that just came back is proof that it does. Proof beats the guess.
 */
let lastSuccessAt = 0;

/**
 * Window in which a successful request still counts as evidence of a connection.
 *
 * Twice the slowest automatic refetch in the app (30s). Equal would be a race:
 * the evidence expires at the same moment the next poll is due, and the banner
 * flashes in the gap. Double leaves one whole missed poll of headroom.
 *
 * Beyond this window the OS signal takes over again, which is correct — an app
 * sitting idle with no traffic has no evidence either way, and deferring to the
 * operating system is the honest default.
 */
const SUCCESS_TTL_MS = 60_000;

/** Called by apiClient on every successful response. */
export function noteNetworkSuccess() {
  lastSuccessAt = Date.now();
}

/** Called by apiClient when a request fails at the transport layer. */
export function noteNetworkFailure() {
  lastSuccessAt = 0;
}

function recentlyReachedServer() {
  return lastSuccessAt > 0 && Date.now() - lastSuccessAt < SUCCESS_TTL_MS;
}

function isOnline(state: Network.NetworkState | undefined) {
  if (!state) return true;
  /* Evidence first. If we have reached our own server in the last half minute
     the device has a working connection, whatever the OS reports. This is what
     keeps a false negative from putting "You're offline" over a working app. */
  if (recentlyReachedServer()) return true;
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

    /* Re-check on a timer as well as on OS events. A successful request is
       evidence the listener never hears about, so without this the banner
       would stay up until the radio next changed state — which, on a device
       that never actually lost its connection, might be never. */
    const poll = setInterval(() => {
      if (cancelled) return;
      Network.getNetworkStateAsync()
        .then((state) => { if (!cancelled) setOffline(!isOnline(state)); })
        .catch(() => { if (!cancelled) setOffline(false); });
    }, 5000);

    return () => { cancelled = true; subscription.remove(); clearInterval(poll); };
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
