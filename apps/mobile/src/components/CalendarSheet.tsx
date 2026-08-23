/**
 * CalendarSheet — a self-contained date picker (no native dependency, so it
 * renders identically on device and in the web preview). Bottom-sheet modal
 * with a month grid, ‹ › month nav, and a tap-the-header year picker for
 * jumping decades back (built for date-of-birth). Future days are disabled.
 */
import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font } from '../lib/theme';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function formatDob(d: Date) {
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}
export function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function CalendarSheet({
  visible, value, onClose, onSelect, minYear = 1920,
}: {
  visible: boolean;
  value: Date | null;
  onClose: () => void;
  onSelect: (d: Date) => void;
  minYear?: number;
}) {
  const today = new Date();
  const seed = value || new Date(today.getFullYear() - 25, today.getMonth(), 1);
  const [year, setYear] = useState(seed.getFullYear());
  const [month, setMonth] = useState(seed.getMonth());
  const [mode, setMode] = useState<'days' | 'years'>('days');

  // Re-seed the view each time the sheet opens.
  useEffect(() => {
    if (visible) {
      const s = value || new Date(today.getFullYear() - 25, today.getMonth(), 1);
      setYear(s.getFullYear());
      setMonth(s.getMonth());
      setMode('days');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();
  const cells: Array<number | null> = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const years: number[] = [];
  for (let y = today.getFullYear(); y >= minYear; y--) years.push(y);

  const atCurrentMonth = year === today.getFullYear() && month === today.getMonth();
  const isFuture = (day: number) => new Date(year, month, day) > today;
  const selectedDay = value && value.getFullYear() === year && value.getMonth() === month ? value.getDate() : null;

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (atCurrentMonth) return; if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const navBtn = { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' } as const;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(10,16,14,.5)', justifyContent: 'flex-end' }}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={{ backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 22, paddingBottom: 34 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 18 }} />

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <TouchableOpacity onPress={() => setMode(m => (m === 'days' ? 'years' : 'days'))} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontFamily: font.extra, fontSize: 18, color: colors.ink, letterSpacing: -0.3 }}>{MONTHS[month]} {year}</Text>
              <Ionicons name={mode === 'years' ? 'chevron-up' : 'chevron-down'} size={16} color={colors.muted} />
            </TouchableOpacity>
            {mode === 'days' && (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={prevMonth} style={navBtn} accessibilityRole="button" accessibilityLabel="Previous month"><Ionicons name="chevron-back" size={18} color={colors.ink} /></TouchableOpacity>
                <TouchableOpacity onPress={nextMonth} disabled={atCurrentMonth} style={[navBtn, atCurrentMonth && { opacity: 0.4 }]}><Ionicons name="chevron-forward" size={18} color={colors.ink} /></TouchableOpacity>
              </View>
            )}
          </View>

          {mode === 'days' ? (
            <>
              <View style={{ flexDirection: 'row', marginBottom: 4 }}>
                {WEEKDAYS.map((w, i) => (
                  <Text key={i} style={{ width: `${100 / 7}%`, textAlign: 'center', fontFamily: font.bold, fontSize: 12, color: colors.faint }}>{w}</Text>
                ))}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {cells.map((day, i) => (
                  <View key={i} style={{ width: `${100 / 7}%`, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                    {day !== null && (
                      <TouchableOpacity disabled={isFuture(day)} onPress={() => onSelect(new Date(year, month, day))} style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: selectedDay === day ? colors.dark : 'transparent' }}>
                        <Text style={{ fontFamily: selectedDay === day ? font.extra : font.semibold, fontSize: 15, color: isFuture(day) ? colors.faint : selectedDay === day ? '#fff' : colors.ink }}>{day}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            </>
          ) : (
            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {years.map(y => (
                  <TouchableOpacity key={y} onPress={() => { setYear(y); setMode('days'); }} style={{ width: '25%', paddingVertical: 13, alignItems: 'center' }}>
                    <Text style={{ fontFamily: y === year ? font.extra : font.semibold, fontSize: 15, color: y === year ? colors.accentDeep : colors.ink }}>{y}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
