import { useState, useEffect } from 'react';
import { getQueueData } from '@/lib/mockDataUtils';

export const useQueueMock = () => {
  const [queueData, setQueueData] = useState(getQueueData());
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  // Simulate real-time updates every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(Date.now());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return {
    queueEntries: queueData.queueEntries,
    activeSessions: queueData.activeSessions,
    lastUpdate,
  };
};
