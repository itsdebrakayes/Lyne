import { useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';

interface QueueState {
  position: number;
  estimatedWaitMinutes: number;
  status: string;
}

export const useQueueNotifications = (lineId: string | undefined) => {
  const previousState = useRef<QueueState | null>(null);
  const hasNotifiedNextInLine = useRef(false);
  const hasNotified5MinWarning = useRef(false);

  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) return false;
    
    if (Notification.permission === 'granted') return true;
    
    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    
    return false;
  }, []);

  const sendNotification = useCallback((title: string, body: string, urgent = false) => {
    // Toast notification (always shows)
    if (urgent) {
      toast.success(title, { description: body, duration: 10000 });
    } else {
      toast.info(title, { description: body });
    }

    // Browser push notification
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/favicon.ico',
          tag: `queue-${lineId}`,
          requireInteraction: urgent,
        });
      } catch (e) {
        console.log('Native notification failed:', e);
      }
    }
  }, [lineId]);

  const checkForNotifications = useCallback((currentState: QueueState) => {
    const prev = previousState.current;

    // Being called to the counter (serving status)
    if (currentState.status === 'serving' && prev?.status !== 'serving') {
      sendNotification(
        "🔔 You're Being Called!",
        "Please proceed to the counter now!",
        true
      );
      return;
    }

    // Next in line (position = 1)
    if (currentState.position === 1 && !hasNotifiedNextInLine.current) {
      hasNotifiedNextInLine.current = true;
      sendNotification(
        "⏰ You're Next!",
        "Get ready - you'll be called shortly!",
        true
      );
      return;
    }

    // 5 minutes warning
    if (currentState.estimatedWaitMinutes <= 5 && 
        currentState.estimatedWaitMinutes > 0 && 
        !hasNotified5MinWarning.current &&
        currentState.position > 1) {
      hasNotified5MinWarning.current = true;
      sendNotification(
        "⏱️ Almost Your Turn",
        `Estimated wait: ${currentState.estimatedWaitMinutes} minutes`,
        false
      );
      return;
    }

    // Wait time extended
    if (prev && currentState.estimatedWaitMinutes > prev.estimatedWaitMinutes + 5) {
      sendNotification(
        "⌛ Wait Time Extended",
        `New estimated wait: ${currentState.estimatedWaitMinutes} minutes`,
        false
      );
      return;
    }

    // Wait time shortened significantly
    if (prev && currentState.estimatedWaitMinutes < prev.estimatedWaitMinutes - 3 && currentState.estimatedWaitMinutes > 5) {
      sendNotification(
        "🚀 Queue Moving Faster!",
        `New estimated wait: ${currentState.estimatedWaitMinutes} minutes`,
        false
      );
      return;
    }

    // Position improved
    if (prev && currentState.position < prev.position && currentState.position > 1) {
      // Only notify on significant position changes (every 3 spots)
      if ((prev.position - currentState.position) >= 3) {
        sendNotification(
          "📍 Position Update",
          `You're now #${currentState.position} in line`,
          false
        );
      }
    }

    previousState.current = currentState;
  }, [sendNotification]);

  // Request permission on mount
  useEffect(() => {
    if (lineId) {
      requestNotificationPermission();
    }
  }, [lineId, requestNotificationPermission]);

  // Reset notification flags when lineId changes
  useEffect(() => {
    hasNotifiedNextInLine.current = false;
    hasNotified5MinWarning.current = false;
    previousState.current = null;
  }, [lineId]);

  return { checkForNotifications, sendNotification };
};
