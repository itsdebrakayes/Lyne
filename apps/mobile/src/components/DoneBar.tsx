/**
 * DoneBar — the way out of a flow that has just finished.
 *
 * Booking a session place or scheduling a Line Helper is several screens deep.
 * Once it is done, the only way home was the back button, which walked the
 * person back through every screen they had just completed and felt like
 * undoing it. This is the exit: "Done" goes straight to Home and clears those
 * screens off the stack, and an edit action sits beside it for the one thing
 * people want after confirming something, which is to change it.
 *
 * Done counts down and fires on its own, so someone who books and puts the
 * phone in their pocket comes back to Home rather than to a finished form.
 * The countdown stops while the screen is not in front, and for good once the
 * edit action is pressed.
 *
 * useGoHome() is exported for the screen's own back arrow and Android's
 * hardware back, so every way out of a finished flow lands in the same place.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { BackHandler, Text, View } from 'react-native';
import { CommonActions, useIsFocused, useNavigation } from '@react-navigation/native';
import { colors, font, radius } from '../lib/theme';
import { Press } from './Press';

/** Home, with everything behind it cleared, so Back cannot replay the flow. */
export function useGoHome() {
  const navigation = useNavigation<any>();
  return useCallback(() => {
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Main', params: { screen: 'Home' } }] }));
  }, [navigation]);
}

/** While `active`, Android's hardware back goes Home instead of back a step. */
export function useBackGoesHome(active: boolean) {
  const goHome = useGoHome();
  const focused = useIsFocused();
  useEffect(() => {
    if (!active || !focused) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { goHome(); return true; });
    return () => sub.remove();
  }, [active, focused, goHome]);
}

export default function DoneBar({ seconds = 30, editLabel, onEdit, note }: {
  /** How long before it goes Home on its own. */
  seconds?: number;
  /** The change action, e.g. "Change Or Cancel". Omitted, only Done shows. */
  editLabel?: string;
  onEdit?: () => void;
  /** One line above the buttons, e.g. where to find this again. */
  note?: string;
}) {
  const goHome = useGoHome();
  const focused = useIsFocused();
  const [left, setLeft] = useState(seconds);
  const [stopped, setStopped] = useState(false);

  useEffect(() => {
    if (!focused || stopped) return undefined;
    const t = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [focused, stopped]);

  useEffect(() => {
    if (left <= 0 && !stopped) goHome();
  }, [left, stopped, goHome]);

  return (
    <View style={{ gap: 10, marginTop: 4 }}>
      {note ? (
        <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: colors.muted, textAlign: 'center', lineHeight: 18 }}>{note}</Text>
      ) : null}
      <Press role="button" haptic label={`Done. Back to Home${stopped ? '' : ` in ${left} seconds`}`} onPress={goHome}
        style={{ height: 56, borderRadius: radius.xl, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: font.extra, fontSize: 15.5, color: '#fff' }}>Done</Text>
        {!stopped ? (
          <Text style={{ fontFamily: font.semibold, fontSize: 11.5, color: 'rgba(255,255,255,.75)', marginTop: 2, fontVariant: ['tabular-nums'] }}>
            Back to Home in {Math.max(0, left)}s
          </Text>
        ) : null}
      </Press>
      {editLabel && onEdit ? (
        <Press role="button" label={editLabel} onPress={() => { setStopped(true); onEdit(); }}
          style={{ height: 50, borderRadius: radius.xl, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: font.extra, fontSize: 14.5, color: colors.accent }}>{editLabel}</Text>
        </Press>
      ) : null}
    </View>
  );
}
