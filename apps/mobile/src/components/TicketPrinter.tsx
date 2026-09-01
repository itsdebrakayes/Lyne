/**
 * TicketPrinter — the ticket arrives the way a ticket arrives.
 *
 * A queue number IS a printed ticket everywhere else in the world: you press the
 * button at the door of the bank and a strip of thermal paper comes out of a
 * slot. The app replaced that object with a card that fades in, which is
 * correct and forgettable. This gives the object back — a terminal slot at the
 * top of the screen and the pass rolling out of it, once, on the visit where it
 * was actually issued.
 *
 * The slot is not decoration painted behind the card. It is a real mask: the
 * paper is clipped at the slot line, so scrolling the ticket up feeds it back
 * into the machine rather than sliding it under a picture of a machine. That is
 * the whole reason it reads as physical, and it costs one `overflow: hidden`.
 *
 * It prints ONCE per ticket, not once per visit.
 *
 * People open this screen over and over while they wait — it is the number they
 * came for, and the tab bar puts it one tap away. An animation that replays on
 * every glance is a toll on the most repeated action in the app, which is the
 * same objection that killed a longer opening sequence earlier. So the print is
 * the moment of issue, remembered per ticket id; every visit after that lands on
 * paper already hanging from the slot.
 *
 * The feed is linear. Printers do not ease out — a decelerating receipt reads as
 * an animation of a printer rather than as a printer.
 */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  Easing as REasing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../lib/theme';
import { useReducedMotion } from '../lib/motion';
import { haptics } from '../lib/haptics';

/** Long enough to watch paper travel, short enough not to be a loading screen. */
const FEED_MS = 1500;

const printedKey = (id: string) => `ticket-printed:${id}`;

/** The terminal. A dark housing with a black slit, and a shadow beneath it so
 *  the paper reads as coming from behind rather than from underneath. */
export function PrinterSlot() {
  return (
    <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
      <View
        style={{
          height: 20,
          borderRadius: 7,
          backgroundColor: '#060d18',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,.10)',
          justifyContent: 'center',
          // The paper comes out from under this, so the housing casts down.
          shadowColor: '#000',
          shadowOpacity: 0.55,
          shadowRadius: 9,
          shadowOffset: { width: 0, height: 5 },
          elevation: 7,
        }}
      >
        <View
          style={{
            height: 4,
            marginHorizontal: 14,
            borderRadius: 2,
            backgroundColor: '#000',
          }}
        />
      </View>
    </View>
  );
}

export function TicketPrinter({
  printKey,
  children,
}: {
  /** Ticket id. Undefined means "do not print" — nothing to remember it by. */
  printKey?: string;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const [height, setHeight] = useState(0);
  /** null while we are still asking storage whether this ticket has printed. */
  const [shouldPrint, setShouldPrint] = useState<boolean | null>(null);

  const y = useSharedValue(0);
  /* Hidden until both answers are in. Otherwise the ticket paints at rest for a
     frame and then jumps up to print, which looks like a bug rather than a
     printer. */
  const shown = useSharedValue(0);

  useEffect(() => {
    let alive = true;
    if (!printKey) { setShouldPrint(false); return; }
    AsyncStorage.getItem(printedKey(printKey))
      .then(seen => { if (alive) setShouldPrint(seen !== '1'); })
      // Storage failing should cost the animation, not the ticket.
      .catch(() => { if (alive) setShouldPrint(false); });
    return () => { alive = false; };
  }, [printKey]);

  useEffect(() => {
    if (shouldPrint === null || !height) return;

    if (shouldPrint && !reduced) {
      y.value = -height;
      y.value = withTiming(0, { duration: FEED_MS, easing: REasing.linear });
      haptics.select();
    } else {
      y.value = 0;
    }
    shown.value = withTiming(1, { duration: 120 });

    // Remembered even when Reduce Motion skipped the feed: the ticket has been
    // issued either way, and turning motion back on should not reprint it.
    if (shouldPrint && printKey) AsyncStorage.setItem(printedKey(printKey), '1').catch(() => {});
  }, [shouldPrint, height, reduced, printKey, y, shown]);

  const paper = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: y.value }],
  }));

  return (
    <View style={{ flex: 1, backgroundColor: colors.dark }}>
      <PrinterSlot />
      {/* The mask. Everything above this line is inside the machine — which is
          what makes scrolling feed the paper back in for free. */}
      <View
        style={{ flex: 1, overflow: 'hidden' }}
        onLayout={e => setHeight(e.nativeEvent.layout.height)}
      >
        <Animated.View style={[{ flex: 1 }, paper]}>{children}</Animated.View>
      </View>
    </View>
  );
}

export default TicketPrinter;
