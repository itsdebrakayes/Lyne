/**
 * TriageQuestions — a department's yes/no questions, asked when joining.
 *
 * Used by the phone's join screen and by the iPad kiosk. Answering never
 * changes the line or the place in it. A "yes" to a red-flag question tags the
 * ticket "possibly urgent" for staff to review, and the person is told to go
 * to the triage desk now rather than wait (see UrgentNotice). The wording never
 * diagnoses: it is a prompt for a clinician, not a decision.
 */
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font } from '../lib/theme';

export interface TriageQuestion {
  id: string;
  question: string;
  detail?: string | null;
  red_flag: boolean;
}

export type TriageAnswers = Record<string, boolean>;

export const triageComplete = (questions: TriageQuestion[], answers: TriageAnswers) =>
  questions.every((q) => typeof answers[q.id] === 'boolean');

export const triageRedFlag = (questions: TriageQuestion[], answers: TriageAnswers) =>
  questions.some((q) => q.red_flag && answers[q.id] === true);

export const triagePayload = (questions: TriageQuestion[], answers: TriageAnswers) =>
  questions.map((q) => ({ question_id: q.id, answer: answers[q.id] === true }));

export function TriageQuestions({ questions, answers, onChange, large = false, onDark = false }: {
  questions: TriageQuestion[];
  answers: TriageAnswers;
  onChange: (next: TriageAnswers) => void;
  /** Kiosk size: bigger type and targets for a wall-mounted iPad. */
  large?: boolean;
  onDark?: boolean;
}) {
  const ink = onDark ? '#fff' : colors.ink;
  const sub = onDark ? 'rgba(255,255,255,.65)' : colors.muted;
  return (
    <View style={{ gap: large ? 14 : 10 }}>
      {questions.map((q) => {
        const value = answers[q.id];
        const choice = (v: boolean) => (
          <TouchableOpacity
            key={String(v)}
            onPress={() => onChange({ ...answers, [q.id]: v })}
            accessibilityRole="radio"
            accessibilityState={{ selected: value === v }}
            accessibilityLabel={`${v ? 'Yes' : 'No'}: ${q.question}`}
            activeOpacity={0.85}
            style={{
              minWidth: large ? 110 : 76, minHeight: large ? 58 : 44, borderRadius: 14, paddingHorizontal: 16,
              alignItems: 'center', justifyContent: 'center', borderWidth: value === v ? 2 : 1,
              borderColor: value === v ? (v && q.red_flag ? colors.danger : colors.accent) : (onDark ? 'rgba(255,255,255,.25)' : colors.border),
              backgroundColor: value === v ? (v && q.red_flag ? 'rgba(220,38,38,.12)' : (onDark ? 'rgba(255,255,255,.12)' : colors.surfaceAlt)) : 'transparent',
            }}
          >
            <Text style={{ fontFamily: font.extra, fontSize: large ? 19 : 15, color: ink }}>{v ? 'Yes' : 'No'}</Text>
          </TouchableOpacity>
        );
        return (
          <View key={q.id} style={{
            flexDirection: large ? 'row' : 'column', alignItems: large ? 'center' : 'stretch', gap: 10,
            paddingVertical: large ? 10 : 8, borderBottomWidth: 1, borderBottomColor: onDark ? 'rgba(255,255,255,.12)' : colors.borderSoft,
          }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: font.bold, fontSize: large ? 20 : 15, color: ink, lineHeight: large ? 27 : 21 }}>{q.question}</Text>
              {q.detail ? <Text style={{ fontFamily: font.medium, fontSize: large ? 15 : 12.5, color: sub, marginTop: 2 }}>{q.detail}</Text> : null}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>{choice(true)}{choice(false)}</View>
          </View>
        );
      })}
    </View>
  );
}

/** Shown when any red-flag answer is yes. */
export function UrgentNotice({ large = false }: { large?: boolean }) {
  return (
    <View accessibilityRole="alert" style={{
      flexDirection: 'row', gap: 12, alignItems: 'flex-start', borderRadius: 18, padding: large ? 20 : 14,
      backgroundColor: 'rgba(220,38,38,.10)', borderWidth: 1, borderColor: 'rgba(220,38,38,.45)',
    }}>
      <Ionicons name="alert-circle" size={large ? 30 : 22} color={colors.danger} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: font.extra, fontSize: large ? 22 : 16, color: colors.danger }}>
          Go to the triage desk now
        </Text>
        <Text style={{ fontFamily: font.semibold, fontSize: large ? 16 : 13.5, color: colors.ink, lineHeight: large ? 23 : 19, marginTop: 4 }}>
          You are still in the line, but please tell a member of staff straight away rather than waiting.
          If this is a life-threatening emergency, call 911.
        </Text>
      </View>
    </View>
  );
}
