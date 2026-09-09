/**
 * ConfirmSheet — a bottom-sheet confirmation for irreversible actions.
 *
 * Native apps on both platforms confirm before anything the user cannot undo,
 * and they say what will be lost rather than asking a bare "Are you sure?".
 * This is an in-app sheet rather than Alert.alert so it looks and behaves the
 * same on iOS, Android and the web preview, and matches the app's own styling.
 *
 * Conventions kept: the safe choice (Cancel) is always present and is the
 * default, tapping the scrim cancels, and the destructive choice is visually
 * marked as destructive rather than being the prettiest button on screen.
 *
 * It sits on DragSheet, so the sheet can also be pulled down and thrown away —
 * the gesture every other sheet on the phone answers to. Dragging is disabled
 * while `busy`, because a request is already in flight and dismissing the
 * sheet would not stop it.
 */
import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font } from '../lib/theme';
import { DragSheet } from './DragSheet';
import { Press } from './Press';

export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  icon = 'alert-circle-outline',
  busy = false,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  /** Say what actually happens — "you lose place 8" beats "are you sure?". */
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <DragSheet
      visible={visible}
      onClose={onCancel}
      dismissible={!busy}
      label={title}
      sheetStyle={{ paddingHorizontal: 24, paddingBottom: 34 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 8 }}>
        <Ionicons name={icon} size={20} color={colors.danger} />
        <Text style={{ fontFamily: font.extra, fontSize: 19, color: colors.ink, letterSpacing: -0.4 }}>{title}</Text>
      </View>
      <Text style={{ fontFamily: font.semibold, fontSize: 13.5, color: colors.muted, lineHeight: 20, marginTop: 9 }}>{message}</Text>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 22 }}>
        <Press
          onPress={onCancel}
          disabled={busy}
          label={cancelLabel}
          style={{ flex: 1, minHeight: 54, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontFamily: font.extra, fontSize: 14.5, color: colors.ink }}>{cancelLabel}</Text>
        </Press>

        <Press
          onPress={onConfirm}
          disabled={busy}
          haptic
          label={confirmLabel}
          style={{ flex: 1, minHeight: 54, borderRadius: 18, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.6 : 1 }}
        >
          {busy
            ? <ActivityIndicator color="#fff" />
            : <Text style={{ fontFamily: font.extra, fontSize: 14.5, color: '#fff' }}>{confirmLabel}</Text>}
        </Press>
      </View>
    </DragSheet>
  );
}

export default ConfirmSheet;
