/**
 * BestTimeCard — Reusable "Best Time to Visit" component for mobile.
 *
 * Fetches the latest best_time_to_visit prediction for a given branch from
 * the backend predictions endpoint and renders a compact highlight card.
 * Used on the BranchScreen (service list) so users see the recommendation
 * before deciding whether to join a queue.
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/apiClient';

interface PredictionRow {
  insight_type: string;
  insight_data: {
    best_day?: string;
    best_hour?: number;
    best_hour_label?: string;
    expected_wait_minutes?: number;
    confidence?: number;
    note?: string;
    recommendation?: string;
  };
  branch_name?: string;
  generated_at?: string;
}

interface Props {
  businessId: string;
  branchId: string;
}

function formatHour(h: number): string {
  if (h === 0)  return '12:00 AM';
  if (h < 12)  return `${h}:00 AM`;
  if (h === 12) return '12:00 PM';
  return `${h - 12}:00 PM`;
}

export default function BestTimeCard({ businessId, branchId }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['best-time', businessId, branchId],
    queryFn: () =>
      api.get<PredictionRow[]>(
        `/predictions/public?business_id=${businessId}&branch_id=${branchId}&type=best_time_to_visit`
      ),
    staleTime: 1000 * 60 * 30, // 30 minutes — predictions don't change often
  });

  if (isLoading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="small" color="#a78bfa" />
        <Text style={styles.loadingText}>Loading best time…</Text>
      </View>
    );
  }

  if (isError || !data || data.length === 0) {
    // Gracefully hide if no prediction data exists yet
    return null;
  }

  const pred = data[0];
  const d = pred.insight_data;
  const hourLabel = d.best_hour_label ?? (d.best_hour !== undefined ? formatHour(d.best_hour) : null);
  const waitMin   = d.expected_wait_minutes;

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerIcon}>🤖</Text>
        <Text style={styles.headerLabel}>AI — Best Time to Visit</Text>
      </View>

      {/* Main recommendation */}
      <View style={styles.body}>
        <View style={styles.recRow}>
          {d.best_day && (
            <View style={styles.pill}>
              <Text style={styles.pillIcon}>📅</Text>
              <Text style={styles.pillText}>{d.best_day}</Text>
            </View>
          )}
          {hourLabel && (
            <View style={styles.pill}>
              <Text style={styles.pillIcon}>⏰</Text>
              <Text style={styles.pillText}>{hourLabel}</Text>
            </View>
          )}
          {waitMin !== undefined && (
            <View style={[styles.pill, styles.pillGreen]}>
              <Text style={styles.pillIcon}>⚡</Text>
              <Text style={[styles.pillText, styles.pillTextGreen]}>~{waitMin} min wait</Text>
            </View>
          )}
        </View>
        {(d.note || d.recommendation) && <Text style={styles.note}>{d.note || d.recommendation}</Text>}
      </View>

      {/* Footer */}
      <Text style={styles.footer}>
        Powered by Q ME NOW Predictions
        {pred.generated_at ? ` · Updated ${new Date(pred.generated_at).toLocaleDateString()}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  loadingText: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },

  card: {
    backgroundColor: 'rgba(139,92,246,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.28)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  headerIcon: { fontSize: 14 },
  headerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#a78bfa',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  body: { gap: 8 },
  recRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(139,92,246,0.18)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillGreen: { backgroundColor: 'rgba(16,185,129,0.18)' },
  pillIcon: { fontSize: 13 },
  pillText: { color: '#c4b5fd', fontSize: 13, fontWeight: '600' },
  pillTextGreen: { color: '#6ee7b7' },
  note: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  footer: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 10,
    marginTop: 10,
  },
});
