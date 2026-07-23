import { useCallback, useState } from 'react';

/**
 * Pull-to-refresh helper: wires a RefreshControl's `refreshing` flag to one or
 * more react-query refetch() calls, clearing the spinner once they all settle.
 *
 *   const { refreshing, onRefresh } = useRefresh(branchQuery.refetch, servicesQuery.refetch);
 *   <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} />
 */
export function useRefresh(...refetchers: Array<() => Promise<unknown>>) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled(refetchers.map((fn) => fn()));
    } finally {
      setRefreshing(false);
    }
    // react-query refetch handles are stable across renders; re-listing them in
    // deps would just recreate the callback needlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { refreshing, onRefresh };
}
