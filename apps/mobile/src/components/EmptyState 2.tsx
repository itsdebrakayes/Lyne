/**
 * EmptyState — the one empty state.
 *
 * Four screens had grown their own hand-written version of this, already
 * drifting apart in icon size, spacing and tone. An empty screen is the moment
 * a user is most likely to conclude the app is broken, so it is exactly the
 * wrong place for the app to look inconsistent.
 *
 * Every empty state must do three things, and this component makes it hard not
 * to: name what is missing, say why it is worth having, and offer the one
 * action that fixes it. "No data" is not an empty state — it is a shrug.
 *
 * `tone="dark"` is for the navy screens (ticket, queue map); the default suits
 * the paper canvas.
 */
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { colors, font, shadow } from '../lib/theme';
import Icon, { IconName } from './Icon';
import Appear from './Appear';

interface Props {
  icon: IconName;
  title: string;
  /** One or two sentences. Say what they gain, not what the system lacks. */
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  /** A quieter secondary line — a hint, a correction, a last-visit reminder. */
  footnote?: React.ReactNode;
  tone?: 'light' | 'dark';
  /** Trim the vertical padding where the state sits inside an existing card. */
  compact?: boolean;
}

export default function EmptyState({
  icon, title, body, actionLabel, onAction, footnote, tone = 'light', compact,
}: Props) {
  const dark = tone === 'dark';
  const art = compact ? 96 : 132;

  return (
    <Appear>
      <View style={{ alignItems: 'center', paddingVertical: compact ? 24 : 40, paddingHorizontal: 14 }}>
        <View
          style={{
            width: art, height: art, borderRadius: art / 3,
            backgroundColor: dark ? 'rgba(255,255,255,.07)' : colors.surface,
            alignItems: 'center', justifyContent: 'center',
            marginBottom: compact ? 18 : 26,
            ...(dark ? null : shadow.card),
          }}
        >
          <Icon name={icon} size={art * 0.44} color={dark ? 'rgba(255,255,255,.4)' : colors.faint} />
        </View>

        <Text style={{ fontFamily: font.extra, fontSize: compact ? 19 : 24, letterSpacing: -0.8, color: dark ? '#fff' : colors.ink, textAlign: 'center' }}>
          {title}
        </Text>
        <Text style={{ fontFamily: font.medium, fontSize: compact ? 13.5 : 14.5, lineHeight: compact ? 19 : 21, color: dark ? 'rgba(255,255,255,.55)' : colors.muted, textAlign: 'center', marginTop: 10, maxWidth: 300 }}>
          {body}
        </Text>

        {!!actionLabel && !!onAction && (
          <TouchableOpacity
            onPress={onAction}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            style={{ backgroundColor: colors.accent, borderRadius: 17, paddingVertical: 16, paddingHorizontal: 26, marginTop: 24 }}
          >
            <Text style={{ fontFamily: font.extra, fontSize: 15, color: colors.accentInk }}>{actionLabel}</Text>
          </TouchableOpacity>
        )}

        {!!footnote && (
          <View style={{ marginTop: 14 }}>
            {typeof footnote === 'string'
              ? <Text style={{ fontFamily: font.bold, fontSize: 13.5, color: dark ? 'rgba(255,255,255,.45)' : colors.muted, textAlign: 'center' }}>{footnote}</Text>
              : footnote}
          </View>
        )}
      </View>
    </Appear>
  );
}
