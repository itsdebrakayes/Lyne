/**
 * TodayForecast — the dark card at the top of "Plan your visit".
 *
 * Screen 01 of the Predictive Insights design: today's wait, hour by hour, with
 * NOW marked where you are in the day and BEST on the hour worth aiming for.
 *
 * It is the hero of the screen because it is the only question most people
 * actually have — "when should I go today" — and the answer is one glance at a
 * shape rather than a number to interpret. The week strip and the heatmap below
 * answer the same question across more time, which is what the subscription
 * buys; this one is free, and deliberately so. A paywall in front of the thing
 * that demonstrates the product sells nothing.
 *
 * Bars are sized from the server's `intensity` rather than from the maximum of
 * whatever happens to be on screen, so two phones showing the same branch draw
 * the same chart — and a branch whose quiet hour is 7 minutes does not render
 * identically to one whose quiet hour is 40.
 */
import React from 'react';
import { Text, View } from 'react-native';
import { font } from '../lib/theme';

export interface ForecastHour {
  hour: number;
  hour_label: string;
  avg_wait: number;
  visits: number;
  level: 1 | 2 | 3;
  /** 0–1, this hour's wait against the worst hour of the day. */
  intensity: number;
  is_best: boolean;
}

export interface TodayForecastProps {
  dayName: string;
  /** False when the branch has no history for today and this is another day's
      pattern. The heading changes; it must never be labelled as today. */
  isToday?: boolean;
  /** The hour worth aiming for, already chosen server-side on real evidence. */
  bestLabel?: string;
  bestWait?: number;
  hours: ForecastHour[];
}

/* Values from the design, not approximations of it. */
const CARD = '#0c1826';
const BEST_BAR = '#2e6bff';
const BEST_INK = '#7da3e0';
const NOW_BAR = 'rgba(255,255,255,.55)';
const IDLE_BAR = 'rgba(255,255,255,.16)';
const MAX_BAR = 82;

export function TodayForecast({ dayName, isToday = true, bestLabel, bestWait, hours }: TodayForecastProps) {
  if (!hours.length) return null;

  const nowHour = new Date().getHours();
  /* "Now" is only meaningful inside opening hours AND on an actual today.
     Outside them nothing is highlighted, rather than clamping to the first or
     last bar and telling somebody at 9pm that they are standing in the 4pm
     slot — and a typical-Monday card has no "now" at all. */
  const showNow = isToday && hours.some((h) => h.hour === nowHour);

  /* Five labels under nine bars, as the design has it — one per bar is a wall
     of text at this width. Every other hour, always including the last. */
  const axis = hours.filter((_, i) => i % 2 === 0 || i === hours.length - 1);

  return (
    <View
      style={{
        backgroundColor: CARD,
        borderRadius: 26,
        padding: 20,
        shadowColor: '#0c1826',
        shadowOpacity: 0.6,
        shadowRadius: 40,
        shadowOffset: { width: 0, height: 18 },
        elevation: 8,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: font.bold, fontSize: 10.5, letterSpacing: 0.6, color: 'rgba(255,255,255,.55)' }}>
            {isToday ? `BEST TIME TODAY · ${dayName.toUpperCase()}` : `A TYPICAL ${dayName.toUpperCase()}`}
          </Text>
          <Text style={{ fontFamily: font.extra, fontSize: 22, letterSpacing: -0.4, color: '#fff', marginTop: 4 }}>
            {bestLabel || 'No clear best hour'}
          </Text>
        </View>
        {typeof bestWait === 'number' && (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: font.extra, fontSize: 26, color: BEST_INK, lineHeight: 28 }}>
              {Math.round(bestWait)}<Text style={{ fontSize: 13 }}>m</Text>
            </Text>
            <Text style={{ fontFamily: font.bold, fontSize: 11, color: 'rgba(255,255,255,.55)', marginTop: 4 }}>
              typical wait
            </Text>
          </View>
        )}
      </View>

      {/* The bars. accessibilityRole="image" with one summary label, rather
          than nine unlabelled views a screen reader would read as nothing —
          the chart is one fact, not nine. */}
      <View
        accessibilityRole="image"
        accessibilityLabel={
          `${isToday ? 'Wait by hour today' : `Wait by hour on a typical ${dayName}`}. Quietest at ${bestLabel || 'no clear hour'}`
          + (typeof bestWait === 'number' ? `, about ${Math.round(bestWait)} minutes.` : '.')
        }
        style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 110, marginTop: 20 }}
      >
        {hours.map((h) => {
          const isNow = showNow && h.hour === nowHour;
          const tag = h.is_best ? 'BEST' : isNow ? 'NOW' : '';
          return (
            <View key={h.hour} style={{ flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
              {/* An EMPTY VIEW holds the space when there is no tag, rather
                  than a transparent "NOW". opacity:0 leaves the word in the
                  tree — it is read aloud, and it lands in the page text — so
                  the card announced "NOW NOW NOW BEST NOW NOW NOW". Invisible
                  is not the same as absent. */}
              {tag ? (
                <Text
                  style={{
                    fontFamily: font.extra, fontSize: 9.5, lineHeight: 12,
                    color: h.is_best ? BEST_INK : '#fff',
                  }}
                >
                  {tag}
                </Text>
              ) : (
                <View style={{ height: 12 }} />
              )}
              <View
                style={{
                  width: '100%',
                  height: Math.max(10, Math.round(h.intensity * MAX_BAR)),
                  borderRadius: 7,
                  backgroundColor: h.is_best ? BEST_BAR : isNow ? NOW_BAR : IDLE_BAR,
                  borderWidth: isNow ? 1.5 : 0,
                  borderColor: 'rgba(255,255,255,.5)',
                }}
              />
            </View>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
        {axis.map((h) => (
          <Text key={h.hour} style={{ fontFamily: font.bold, fontSize: 10.5, color: 'rgba(255,255,255,.45)' }}>
            {h.hour_label}
          </Text>
        ))}
      </View>

      <Text style={{ fontFamily: font.semibold, fontSize: 11.5, color: 'rgba(255,255,255,.45)', marginTop: 14 }}>
        {isToday
          ? 'From the last 90 days of real visits · updates continuously'
          : `This branch has no history for today, so this is its busiest day. From the last 90 days of real visits.`}
      </Text>
    </View>
  );
}

export default TodayForecast;
