/**
 * LeaveReasonSheet — the one question worth asking someone who just walked.
 *
 * A queue that people abandon is the most useful signal this product has, and
 * the numbers alone cannot explain it. "Fourteen people left the Property Tax
 * line before 11am" is a fact; whether they left because the wait was hopeless,
 * because they had the wrong papers, or because somebody at a desk helped them
 * in passing are three different problems with three different fixes.
 *
 * It appears AFTER the person has already left, never before. Leaving is the
 * moment they are least patient with this app: a form in front of the exit both
 * delays them and biases the answer toward whatever is fastest to tap. They are
 * already out of the line by the time this opens, and Skip is a real option
 * sitting in plain sight rather than a dismissive X in a corner.
 *
 * No free text. A text box here would be answered by almost nobody and would
 * produce something unaggregatable from the few who did — and it is one more
 * thing to type while walking out of a building.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Modal, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font } from '../lib/theme';

/** Values match the server's accepted set. Order is by how often we expect it. */
export const LEAVE_REASONS: { value: string; label: string }[] = [
  { value: 'wait_too_long', label: 'The wait was too long' },
  { value: 'came_back_later', label: "I'll come back another time" },
  { value: 'no_longer_needed', label: "I don't need it any more" },
  { value: 'wrong_line', label: 'I joined the wrong line' },
  { value: 'served_elsewhere', label: 'Someone helped me already' },
  { value: 'other', label: 'Another reason' },
];

export function LeaveReasonSheet({
  visible,
  onPick,
  onSkip,
}: {
  visible: boolean;
  /** Resolves when the answer is recorded; the sheet handles its own spinner. */
  onPick: (reason: string) => Promise<void> | void;
  onSkip: () => void;
}) {
  const [sending, setSending] = useState<string | null>(null);

  const choose = async (value: string) => {
    if (sending) return;
    setSending(value);
    try {
      await onPick(value);
    } finally {
      setSending(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onSkip}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <TouchableOpacity activeOpacity={1} onPress={onSkip} style={{ flex: 1, backgroundColor: 'rgba(10,16,14,.5)' }} />
        <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 34 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 18 }} />

          <Text style={{ fontFamily: font.extra, fontSize: 19, color: colors.ink, letterSpacing: -0.4 }}>
            You&apos;ve left the line
          </Text>
          {/* Say what the answer is for. "Help us improve" is the phrasing people
              have learned to ignore; this one names who reads it and what
              changes. */}
          <Text style={{ fontFamily: font.semibold, fontSize: 13.5, color: colors.muted, lineHeight: 20, marginTop: 9 }}>
            If you tell us why, the branch sees it. It is the only way they find out a
            line is losing people and not just moving slowly.
          </Text>

          <View style={{ marginTop: 18, gap: 8 }}>
            {LEAVE_REASONS.map((r) => (
              <TouchableOpacity
                key={r.value}
                onPress={() => choose(r.value)}
                disabled={!!sending}
                accessibilityRole="button"
                accessibilityLabel={r.label}
                style={{
                  minHeight: 52,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceAlt,
                  paddingHorizontal: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  opacity: sending && sending !== r.value ? 0.5 : 1,
                }}
              >
                <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 14.5, color: colors.ink }}>
                  {r.label}
                </Text>
                {sending === r.value
                  ? <ActivityIndicator color={colors.accent} />
                  : <Ionicons name="chevron-forward" size={16} color={colors.muted} />}
              </TouchableOpacity>
            ))}
          </View>

          {/* A real button, the same size as the others — not a greyed link.
              Somebody who does not want to answer should not have to hunt. */}
          <TouchableOpacity
            onPress={onSkip}
            disabled={!!sending}
            accessibilityRole="button"
            accessibilityLabel="Skip"
            style={{ minHeight: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 12 }}
          >
            <Text style={{ fontFamily: font.extra, fontSize: 14.5, color: colors.muted }}>Skip</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default LeaveReasonSheet;
