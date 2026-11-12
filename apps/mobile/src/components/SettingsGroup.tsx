/**
 * SettingsGroup — the grouped list Settings, Account and Privacy are built from,
 * so the three read as one place (the iOS Settings pattern: a quiet heading, a
 * white card of rows, one idea per row, an optional footnote under the card).
 *
 * Each row: an icon on a soft tile, the label, and on the right either a value,
 * a control (a Switch) or a chevron. A row with `sub` gets a second, muted line
 * for the one sentence that explains it. `tone: 'danger'` is only for rows that
 * remove something (Log out, Delete account, Sign out everywhere).
 */
import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import Icon, { IconName } from './Icon';
import { colors, font } from '../lib/theme';

export type SettingsRow = {
  icon: IconName;
  label: string;
  value?: string;
  valueTone?: 'muted' | 'accent';
  sub?: string;
  dot?: boolean;
  tone?: 'danger';
  busy?: boolean;
  right?: React.ReactNode;
  onPress?: () => void;
  accessibilityHint?: string;
};

export function SettingsGroup({ title, rows, footer }: { title?: string; rows: SettingsRow[]; footer?: string }) {
  return (
    <View>
      {title ? (
        <Text accessibilityRole="header" style={{ fontFamily: font.semibold, fontSize: 13, color: colors.sub, marginTop: 26, marginBottom: 8, marginLeft: 16 }}>{title}</Text>
      ) : <View style={{ height: 20 }} />}
      <View style={{ backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.borderSoft, overflow: 'hidden' }}>
        {rows.map((r, i) => {
          const danger = r.tone === 'danger';
          const ink = danger ? colors.dangerInk : colors.ink;
          return (
            <TouchableOpacity
              key={r.label}
              disabled={!r.onPress || r.busy}
              onPress={r.onPress}
              accessibilityRole={r.onPress ? 'button' : undefined}
              accessibilityLabel={r.value ? `${r.label}, ${r.value}` : r.label}
              accessibilityHint={r.accessibilityHint}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 13, paddingLeft: 14 }}
            >
              <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: danger ? colors.dangerSoft : colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={r.icon} size={17} color={danger ? colors.dangerInk : colors.ink} />
              </View>
              <View style={{
                flex: 1, minHeight: r.sub ? 64 : 52, paddingVertical: r.sub ? 11 : 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 16,
                borderBottomWidth: i === rows.length - 1 ? 0 : 1, borderBottomColor: colors.borderSoft,
              }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: font.semibold, fontSize: 15, color: ink }}>{r.label}</Text>
                  {r.sub ? <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: colors.muted, marginTop: 2, lineHeight: 17 }}>{r.sub}</Text> : null}
                </View>
                {r.dot ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.light }} /> : null}
                {r.value ? (
                  <Text numberOfLines={1} style={{ maxWidth: 180, fontFamily: font.medium, fontSize: 15, color: r.valueTone === 'accent' ? colors.accent : colors.muted }}>{r.value}</Text>
                ) : null}
                {r.busy ? <ActivityIndicator color={ink} /> : r.right ? r.right : r.onPress ? <Icon name="chevronRight" size={15} color={colors.chevron} /> : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      {footer ? (
        <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: colors.muted, marginTop: 8, marginHorizontal: 16, lineHeight: 18 }}>{footer}</Text>
      ) : null}
    </View>
  );
}

/** The back button and title every pushed settings screen starts with. */
export function SettingsHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <TouchableOpacity onPress={onBack} accessibilityRole="button" accessibilityLabel="Back"
        style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="back" size={20} color={colors.ink} />
      </TouchableOpacity>
      <Text accessibilityRole="header" style={{ fontFamily: font.extra, fontSize: 24, letterSpacing: -0.6, color: colors.ink }}>{title}</Text>
    </View>
  );
}
