/**
 * BusyHeatmap — when a service is quiet, as a day x hour grid.
 *
 * Reads the `grid` now returned by /predictions/best-times: one cell per
 * (day, hour) with the visit count, the average wait, and a level on the same
 * 1-3 scale the week strip uses. Cells with too little history simply are not
 * in the grid, and render as blanks rather than as confident-looking zeros.
 *
 * MONOCHROME, NOT TRAFFIC-LIGHT. The obvious thing is green/amber/red, and the
 * app already has colors.light / moderate / busy for exactly that. It is wrong
 * here for two reasons. docs/DESIGN_DIAGNOSIS_AND_PALETTE.md §3.1 assigns
 * BLUE-DEEP as "dense-data ink: chart fills, table emphasis" and allows "no
 * green except where a status genuinely requires it" — a busy Tuesday is not a
 * status, it is a measurement. And sixty-three cells in three saturated hues is
 * a stained-glass window: the eye cannot rank it, which is the one thing a
 * heatmap exists to let you do. A single hue ramped by lightness ranks at a
 * glance.
 *
 * Quiet reads LIGHT and busy reads DARK, which matches the physical intuition
 * — a dense cell is a crowded hour.
 */
import React, { useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { colors, font } from '../lib/theme';

export interface HeatCell {
  dow: number;
  hour: number;
  visits: number;
  avg_wait: number;
  /** 1 quiet · 2 busy · 3 peak, from the API on the same scale as the week strip. */
  level: 1 | 2 | 3;
}

/* The ramp. Values from DESIGN_DIAGNOSIS_AND_PALETTE.md §3.1 — BLUE-SOFT at the
   quiet end, BLUE-DEEP at the peak, one step between. `none` is LINE: present
   on the grid so the shape of the week stays readable, but plainly not data. */
const RAMP: Record<number, string> = {
  0: '#E2E7F0', // LINE — no evidence for this hour
  1: '#C9DAF4', // quiet
  2: '#6E96D4', // busy
  3: '#1B4B8F', // BLUE-DEEP — peak
};

const DAY_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** 9am, 2pm — short enough for a column header. */
function shortHour(hour: number): string {
  const suffix = hour < 12 ? 'a' : 'p';
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}${suffix}`;
}

function fullHour(hour: number): string {
  const suffix = hour < 12 ? 'AM' : 'PM';
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h} ${suffix}`;
}

export interface BusyHeatmapProps {
  grid: HeatCell[];
  /** Called when a cell is chosen, so the parent can show the detail card. */
  onSelect?: (cell: HeatCell | null) => void;
}

export function BusyHeatmap({ grid, onSelect }: BusyHeatmapProps) {
  const [selected, setSelected] = useState<string | null>(null);

  /* Derive the axes from the data rather than assuming 8-17. The endpoint
     restricts hours today, but a branch that opens on Saturday or closes at
     3pm should produce a grid of that shape, not a grid with dead columns. */
  const { hours, days, byKey } = useMemo(() => {
    const hourSet = new Set<number>();
    const daySet = new Set<number>();
    const map = new Map<string, HeatCell>();
    grid.forEach((cell) => {
      hourSet.add(cell.hour);
      daySet.add(cell.dow);
      map.set(`${cell.dow}-${cell.hour}`, cell);
    });
    return {
      hours: [...hourSet].sort((a, b) => a - b),
      days: [...daySet].sort((a, b) => a - b),
      byKey: map,
    };
  }, [grid]);

  if (!grid.length) return null;

  const choose = (cell: HeatCell | null, key: string) => {
    const next = selected === key ? null : key;
    setSelected(next);
    onSelect?.(next ? cell : null);
  };

  const CELL = 26;
  const GAP = 4;

  return (
    <View>
      {/* Horizontally scrollable: ten hours at a legible tap size is wider than
          a phone, and squeezing them to fit produces 18pt targets. Scrolling is
          the honest trade. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {/* Hour axis */}
          <View style={{ flexDirection: 'row', marginLeft: 34, marginBottom: 6 }}>
            {hours.map((hour) => (
              <View key={hour} style={{ width: CELL, marginRight: GAP, alignItems: 'center' }}>
                <Text style={{ fontFamily: font.semibold, fontSize: 9.5, color: colors.muted }}>
                  {shortHour(hour)}
                </Text>
              </View>
            ))}
          </View>

          {days.map((dow) => (
            <View key={dow} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: GAP }}>
              <Text
                style={{
                  width: 34, fontFamily: font.semibold, fontSize: 10.5, color: colors.muted,
                }}
              >
                {DAY_LABEL[dow]}
              </Text>
              {hours.map((hour) => {
                const key = `${dow}-${hour}`;
                const cell = byKey.get(key);
                const isSelected = selected === key;
                return (
                  <TouchableOpacity
                    key={key}
                    activeOpacity={cell ? 0.7 : 1}
                    disabled={!cell}
                    onPress={() => cell && choose(cell, key)}
                    accessibilityRole={cell ? 'button' : undefined}
                    accessibilityLabel={
                      cell
                        ? `${DAY_LABEL[dow]} ${fullHour(hour)}, about ${Math.round(cell.avg_wait)} minutes, from ${cell.visits} visits`
                        : `${DAY_LABEL[dow]} ${fullHour(hour)}, not enough history`
                    }
                    accessibilityState={{ selected: isSelected }}
                    style={{
                      width: CELL,
                      height: CELL,
                      marginRight: GAP,
                      borderRadius: 7,
                      backgroundColor: RAMP[cell?.level ?? 0],
                      /* The selection ring is drawn inside the cell rather than
                         around it, so choosing a cell cannot nudge the grid. */
                      borderWidth: isSelected ? 2 : 0,
                      borderColor: colors.ink,
                    }}
                  />
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Legend. Without it the ramp is just decoration — nobody can say which
          end is the one to aim for. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12 }}>
        <Text style={{ fontFamily: font.semibold, fontSize: 10.5, color: colors.muted }}>Quiet</Text>
        {[1, 2, 3].map((level) => (
          <View
            key={level}
            style={{ width: 22, height: 7, borderRadius: 4, backgroundColor: RAMP[level] }}
          />
        ))}
        <Text style={{ fontFamily: font.semibold, fontSize: 10.5, color: colors.muted }}>Busy</Text>
      </View>
    </View>
  );
}

export default BusyHeatmap;
