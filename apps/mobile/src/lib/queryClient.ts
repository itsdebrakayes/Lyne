/**
 * The app's one React Query client.
 *
 * networkMode 'offlineFirst', for queries and mutations alike: every request is
 * attempted once, and only RETRIES wait for the connection to come back.
 *
 * The default ('online') does not attempt anything while onlineManager says the
 * device is offline. It pauses, and a paused mutation stays isPending forever
 * with no request, no deadline and no error. That is how "Get My Ticket" spun
 * with nothing in the server log: the iOS Simulator (and a branch wifi behind a
 * captive portal) reports no internet on a working connection, the kiosk had
 * been idle for a minute so there was no recent success to outweigh it, and the
 * walk-in was paused instead of sent. Sending it lets apiClient's deadline and
 * error handling give the honest answer either way.
 */
import { QueryClient } from '@tanstack/react-query';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 1, staleTime: 30_000, networkMode: 'offlineFirst' },
      mutations: { networkMode: 'offlineFirst' },
    },
  });
}
