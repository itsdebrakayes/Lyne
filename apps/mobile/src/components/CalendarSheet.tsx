/**
 * CalendarSheet — a self-contained date picker built for date of birth (no
 * native dependency, so it renders identically on device and in the web
 * preview).
 *
 * Year, then month, then day. Paging month by month is the wrong tool for a
 * birthday decades away, so the sheet opens on the year: type it, or tap it in
 * the list. A twelve-month grid follows, then the days. Each heading steps back
 * a level. Future dates are disabled.
 *
 * The day grid renders explicit weeks from monthWeeks(); see lib/dates.ts for
 * why a single wrapping row put days under the wrong weekday.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, inputReset } from '../lib/theme';
import { useNavBarLift } from '../lib/insets';
import { MONTHS, MONTHS_SHORT, formatDob, monthWeeks, toISODate } from '../lib/dates';

export { formatDob, toISODate };

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

type Step = 'year' | 'month' | 'day';

export function CalendarSheet({
  visible, value, onClose, onSelect, minYear = 1920,
}: {
  visible: boolean;
  value: Date | null;
  onClose: () => void;
  onSelect: (d: Date) => void;
  minYear?: number;
}) {
  const lift = useNavBarLift();
  const today = new Date();
  const thisYear = today.getFullYear();
  const [step, setStep] = useState<Step>('year');
  const [year, setYear] = useState(value?.getFullYear() ?? thisYear - 25);
  const [month, setMonth] = useState(value?.getMonth() ?? 0);
  const [typed, setTyped] = useState('');

  // Re-seed each time the sheet opens: straight to the days when editing a date
  // already chosen, otherwise from the year.
  useEffect(() => {
    if (!visible) return;
    setTyped('');
    if (value) {
      setYear(value.getFullYear());
      setMonth(value.getMonth());
      setStep('day');
    } else {
      setYear(thisYear - 25);
      setStep('year');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = thisYear; y >= minYear; y--) list.push(y);
    return list;
  }, [thisYear, minYear]);

  const typedYear = /^\d{4}$/.test(typed) ? Number(typed) : null;
  const typedValid = typedYear !== null && typedYear >= minYear && typedYear <= thisYear;

  const pickYear = (y: number) => { setYear(y); setTyped(''); setStep('month'); };
  const pickMonth = (m: number) => { setMonth(m); setStep('day'); };

  const monthIsFuture = (m: number) => year === thisYear && m > today.getMonth();
  const dayIsFuture = (d: number) => new Date(year, month, d) > today;
  const selectedDay = value && value.getFullYear() === year && value.getMonth() === month ? value.getDate() : null;

  const heading = step === 'year' ? 'Year of birth' : step === 'month' ? String(year) : `${MONTHS[month]} ${year}`;
  const back = step === 'day' ? () => setStep('month') : step === 'month' ? () => setStep('year') : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(10,16,14,.5)', justifyContent: 'flex-end' }}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={{ backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 22, paddingBottom: 34 + lift }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 18 }} />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14, minHeight: 38 }}>
            {back && (
              <TouchableOpacity
                onPress={back}
                accessibilityRole="button"
                accessibilityLabel={step === 'day' ? 'Choose a different month' : 'Choose a different year'}
                style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="chevron-back" size={18} color={colors.ink} />
              </TouchableOpacity>
            )}
            <TouchableOpacity disabled={!back} onPress={back || undefined}>
              <Text style={{ fontFamily: font.extra, fontSize: 18, color: colors.ink, letterSpacing: -0.3 }}>{heading}</Text>
            </TouchableOpacity>
          </View>

          {step === 'year' && (
            <>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                <TextInput
                  value={typed}
                  onChangeText={t => setTyped(t.replace(/\D/g, '').slice(0, 4))}
                  onSubmitEditing={() => { if (typedValid) pickYear(typedYear!); }}
                  placeholder="Type a year, e.g. 1977"
                  placeholderTextColor={colors.faint}
                  keyboardType="number-pad"
                  returnKeyType="next"
                  maxLength={4}
                  accessibilityLabel="Year of birth"
                  style={[{ flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: colors.surfaceAlt, paddingHorizontal: 16, fontFamily: font.semibold, fontSize: 16, color: colors.ink }, inputReset]}
                />
                <TouchableOpacity
                  disabled={!typedValid}
                  onPress={() => typedValid && pickYear(typedYear!)}
                  accessibilityRole="button"
                  style={{ minHeight: 48, paddingHorizontal: 18, borderRadius: 14, backgroundColor: typedValid ? colors.dark : colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ fontFamily: font.bold, fontSize: 15, color: typedValid ? '#fff' : colors.faint }}>Next</Text>
                </TouchableOpacity>
              </View>
              {typed.length === 4 && !typedValid && (
                <Text style={{ fontFamily: font.medium, fontSize: 13, color: colors.danger, marginBottom: 8 }}>
                  Enter a year between {minYear} and {thisYear}.
                </Text>
              )}
              <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {years.map(y => (
                    <TouchableOpacity key={y} onPress={() => pickYear(y)} style={{ width: '25%', paddingVertical: 13, alignItems: 'center' }}>
                      <Text style={{ fontFamily: y === year ? font.extra : font.semibold, fontSize: 15, color: y === year ? colors.accentDeep : colors.ink }}>{y}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </>
          )}

          {step === 'month' && (
            <View>
              {[0, 1, 2, 3].map(row => (
                <View key={row} style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                  {[0, 1, 2].map(col => {
                    const m = row * 3 + col;
                    const off = monthIsFuture(m);
                    const on = value?.getFullYear() === year && value?.getMonth() === m;
                    return (
                      <TouchableOpacity
                        key={m}
                        disabled={off}
                        onPress={() => pickMonth(m)}
                        accessibilityRole="button"
                        accessibilityLabel={`${MONTHS[m]} ${year}`}
                        style={{ flex: 1, minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.dark : colors.surfaceAlt }}
                      >
                        <Text style={{ fontFamily: font.semibold, fontSize: 15, color: off ? colors.faint : on ? '#fff' : colors.ink }}>{MONTHS_SHORT[m]}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          )}

          {step === 'day' && (
            <View>
              <View style={{ flexDirection: 'row', marginBottom: 4 }}>
                {WEEKDAYS.map((w, i) => (
                  <Text key={i} style={{ flex: 1, textAlign: 'center', fontFamily: font.bold, fontSize: 12, color: colors.faint }}>{w}</Text>
                ))}
              </View>
              {monthWeeks(year, month).map((week, wi) => (
                <View key={wi} style={{ flexDirection: 'row' }}>
                  {week.map((day, di) => (
                    <View key={di} style={{ flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                      {day !== null && (
                        <TouchableOpacity
                          disabled={dayIsFuture(day)}
                          onPress={() => onSelect(new Date(year, month, day))}
                          accessibilityRole="button"
                          accessibilityLabel={formatDob(new Date(year, month, day))}
                          style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: selectedDay === day ? colors.dark : 'transparent' }}
                        >
                          <Text style={{ fontFamily: selectedDay === day ? font.extra : font.semibold, fontSize: 15, color: dayIsFuture(day) ? colors.faint : selectedDay === day ? '#fff' : colors.ink }}>{day}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
              ))}
            </View>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
