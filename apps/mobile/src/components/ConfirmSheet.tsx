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
 */
import React from 'react';
import { ActivityIndicator, Modal, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font } from '../lib/theme';
import { HoldButton } from './HoldButton';

export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  icon = 'alert-circle-outline',
  busy = false,
  hold = false,
  holdDoneLabel = 'Done',
  resetSignal,
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
  /**
   * Confirm by holding rather than tapping.
   *
   * For the costliest actions only. A tap inside a sheet is already guarded by
   * having to open the sheet, so this is not about a second guard — it is about
   * the seam where somebody dismisses a sheet they did not read and hits the
   * red button by muscle memory. You cannot do that by accident with a hold,
   * and the fill gives you the whole gesture to change your mind in.
   */
  hold?: boolean;
  /** Label beside the tick once the hold lands. */
  holdDoneLabel?: string;
  /** Bump to send a completed hold back to rest — see HoldButton. */
  resetSignal?: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <TouchableOpacity activeOpacity={1} onPress={onCancel} style={{ flex: 1, backgroundColor: 'rgba(10,16,14,.5)' }} />
        <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 34 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 18 }} />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
            <Ionicons name={icon} size={20} color={colors.danger} />
            <Text style={{ fontFamily: font.extra, fontSize: 19, color: colors.ink, letterSpacing: -0.4 }}>{title}</Text>
          </View>
          <Text style={{ fontFamily: font.semibold, fontSize: 13.5, color: colors.muted, lineHeight: 20, marginTop: 9 }}>{message}</Text>

          {/* Hold mode stacks instead of splitting the row. A gradient sweeping
              half a sheet's width is over in a few centimetres and reads as a
              glitch rather than progress; the gesture needs the full span to be
              legible. Cancel drops underneath, which also puts the safe choice
              nearest the thumb. */}
          {hold ? (
            <View style={{ marginTop: 22, gap: 10 }}>
              <HoldButton
                label={confirmLabel}
                doneLabel={holdDoneLabel}
                tone="danger"
                busy={busy}
                resetSignal={resetSignal}
                onComplete={onConfirm}
              />
              <TouchableOpacity
                onPress={onCancel}
                disabled={busy}
                style={{ minHeight: 50, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontFamily: font.extra, fontSize: 14.5, color: colors.muted }}>{cancelLabel}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 22 }}>
              <TouchableOpacity
                onPress={onCancel}
                disabled={busy}
                style={{ flex: 1, minHeight: 54, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontFamily: font.extra, fontSize: 14.5, color: colors.ink }}>{cancelLabel}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onConfirm}
                disabled={busy}
                style={{ flex: 1, minHeight: 54, borderRadius: 18, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.6 : 1 }}
              >
                {busy
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={{ fontFamily: font.extra, fontSize: 14.5, color: '#fff' }}>{confirmLabel}</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default ConfirmSheet;
