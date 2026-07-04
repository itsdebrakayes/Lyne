/**
 * BestTimeCard — "Best time to visit" recommendation (v4 · fintech style).
 *
 * Reads the latest best_time_to_visit prediction for a branch and renders the
 * model's plain-language summary plus the top recommended slots as pills.
 * Robust to the two shapes the pipeline emits: a bare { summary } and the
 * richer { summary, recommended_slots:[{ day_name, hour, score, reason }] }.
 * Renders nothing until data exists, so it never shows an empty shell.
 */
import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, font } from '../lib/theme';
import api from '../lib/apiClient';

interface Slot {
  day_name?: string;
  hour?: number;
  score?: number;
  reason?: string;
}
interface PredictionRow {
  insight_data: string | { summary?: string; recommended_slots?: Slot[]; note?: string; recommendation?: string };
  generated_at?: string;
}

function parseData(value: PredictionRow['insight_data']) {
  if (typeof value !== 'string') return value || {};
  try { return JSON.parse(value); } catch { return { summary: value }; }
}

function formatHour(h?: number) {
  if (h === undefined || h === null) return '';
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

export default function BestTimeCard({ businessId, branchId }: { businessId: string; branchId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['best-time', businessId, branchId],
    queryFn: () => api.get<PredictionRow[]>(
      `/predictions/public?business_id=${businessId}&branch_id=${branchId}&type=best_time_to_visit`,
    ),
    staleTime: 1000 * 60 * 30,
  });

  if (isLoading) {
    return (
      <View style={{ backgroundColor: colors.dark, borderRadius: 20, padding: 16, marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <ActivityIndicator size="small" color={colors.accent} />
        <Text style={{ fontFamily: font.semibold, fontSize: 12.5, color: 'rgba(255,255,255,.6)' }}>Finding your best time…</Text>
      </View>
    );
  }

  const row = data?.[0];
  if (!row) return null;
  const d = parseData(row.insight_data);
  const summary: string | undefined = d.summary || d.recommendation || d.note;
  const slots: Slot[] = Array.isArray(d.recommended_slots) ? d.recommended_slots.slice(0, 3) : [];
  if (!summary && slots.length === 0) return null;

  return (
    <View style={{ backgroundColor: colors.dark, borderRadius: 20, padding: 16, marginTop: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
        <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,.1)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="sparkles" size={19} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: font.extra, fontSize: 10, color: colors.accent, letterSpacing: 0.8 }}>PREMIUM · SMART TIMING</Text>
          <Text style={{ fontFamily: font.extra, fontSize: 14.5, color: '#fff', marginTop: 2 }}>Best time to visit</Text>
        </View>
      </View>

      {summary && (
        <Text style={{ fontFamily: font.semibold, fontSize: 12.5, color: 'rgba(255,255,255,.7)', lineHeight: 18, marginTop: 12 }}>{summary}</Text>
      )}

      {slots.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {slots.map((s, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,.08)', borderRadius: 13, paddingVertical: 7, paddingHorizontal: 11 }}>
              <Ionicons name="time-outline" size={13} color={colors.accent} />
              <Text style={{ fontFamily: font.bold, fontSize: 12, color: '#fff' }}>
                {[s.day_name, formatHour(s.hour)].filter(Boolean).join(' · ')}
              </Text>
              {typeof s.score === 'number' && (
                <Text style={{ fontFamily: font.extra, fontSize: 11, color: colors.accent }}>{Math.round(s.score)}</Text>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
