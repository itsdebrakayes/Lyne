/**
 * SocialAuthButtons — Apple and Google, placed but not yet wired.
 *
 * Shared by sign in and sign up so the two screens cannot drift, and so that
 * turning these on later is one edit rather than two. That matters more than
 * the usual DRY argument: the day the Developer Program membership lands, these
 * stop being placeholders, and a duplicated version is a duplicated chance to
 * ship one screen live and leave the other grey.
 *
 * Why they are disabled rather than absent: the design calls for them, and a
 * person who has seen them elsewhere looks for them here. Why they are real
 * disabled buttons rather than styled text: a screen reader should announce
 * "Continue with Apple, dimmed" and not read two orphaned words. And why the
 * caption is not optional — a greyed control that says nothing about itself
 * reads as broken software. This one says when it arrives.
 *
 * What they are waiting on, concretely: Google needs an OAuth client configured
 * in Supabase; Apple needs a Services ID, which needs a Developer Program
 * membership, which needs a D-U-N-S number. App Store Guideline 4.8 then makes
 * the pair inseparable — offering Google obliges us to offer Sign in with Apple
 * the same day — so neither can ship alone.
 */
import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../lib/ThemeProvider';
import { colors, font } from '../lib/theme';

/* Sized per glyph rather than one number: Ionicons draws the Apple mark with
   more optical weight than the Google G, so a shared size makes Apple look
   the larger of the two sitting side by side. */
const PROVIDERS: Array<{ label: string; icon: keyof typeof Ionicons.glyphMap; size: number }> = [
  { label: 'Apple', icon: 'logo-apple', size: 19 },
  { label: 'Google', icon: 'logo-google', size: 17 },
];

export function SocialAuthButtons() {
  const { scheme } = useTheme();
  const styles = useMemo(() => makeStyles(), [scheme]);

  return (
    <>
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={styles.socialRow}>
        {PROVIDERS.map(provider => (
          <TouchableOpacity
            key={provider.label}
            disabled
            accessibilityRole="button"
            accessibilityState={{ disabled: true }}
            accessibilityLabel={`Continue with ${provider.label} — not available yet`}
            style={styles.socialBtn}
          >
            <Ionicons name={provider.icon} size={provider.size} color={colors.faint} />
            <Text style={styles.socialText}>{provider.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.socialNote}>Apple and Google sign-in arrive with the App Store release.</Text>
    </>
  );
}

const makeStyles = () => StyleSheet.create({
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 22 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontFamily: font.medium, fontSize: 12.5, color: colors.faint },

  socialRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  socialBtn: {
    flex: 1, height: 52, borderRadius: 16,
    backgroundColor: colors.fieldBg, borderWidth: 1, borderColor: colors.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    opacity: 0.6,
  },
  socialText: { fontFamily: font.bold, fontSize: 14.5, color: colors.faint },
  socialNote: {
    fontFamily: font.medium, fontSize: 11.5, lineHeight: 16,
    color: colors.faint, textAlign: 'center', marginTop: 10,
  },
});

export default SocialAuthButtons;
