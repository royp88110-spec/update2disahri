import { useCallback, useRef, useState } from "react";
import { useData } from "@/context/DataContext";

/**
 * Shared pull-to-refresh hook. Returns `{ refreshing, onRefresh }` ready to
 * pass directly to a RefreshControl.
 *
 * Usage:
 *   const { refreshing, onRefresh } = useRefresh();
 *   <FlatList refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} ... />} />
 */
export function useRefresh() {
  const { refresh } = useData();
  const [refreshing, setRefreshing] = useState(false);
  const inFlightRef = useRef(false);

  const onRefresh = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
      inFlightRef.current = false;
    }
  }, [refresh]);

  return { refreshing, onRefresh };
}
