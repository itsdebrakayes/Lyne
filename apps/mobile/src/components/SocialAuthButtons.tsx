/**
 * SocialAuthButtons — Apple and Google, wired.
 *
 * Shared by sign in and sign up so the two screens cannot drift, and so that
 * turning these on is one edit rather than two. That mattered more than the
 * usual DRY argument while they were placeholders, and it still does: a
 * duplicated version is a duplicated chance to ship one screen working and
 * leave the other dead.
 *
 * BOTH PROVIDERS ARE SHOWN ON BOTH PLATFORMS. Guideline 4.8 obliges Sign in
 * with Apple wherever another social sign-in is offered, which settles iOS. On
 * Android nothing obliges it — it is here because somebody who created their
 * account with Apple on an iPhone has no password, and if the button is absent
 * when they move to Android their account is simply unreachable. See
 * lib/socialAuth.ts for how each one is actually performed; it differs by
 * platform, and that is the one thing this component does not need to know.
 *
 * The caption that used to sit under these ("Apple and Google sign-in arrive
 * with the App Store release") is gone, along with the disabled state it
 * explained. A control that announces what it cannot do yet is Guideline 2.1;
 * the fix was never a better sentence, it was wiring the buttons.
 *
 * Still gated by SOCIAL_AUTH_ENABLED, which stays false until both have been
 * tested on a real device — these are native modules, so that needs a new
 * build, not an OTA update.
 */
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SOCIAL_AUTH_ENABLED } from '../lib/features';
import { useTheme } from '../lib/ThemeProvider';
import { colors, font } from '../lib/theme';
import { useAuth } from '../hooks/useAuth';
import type { SocialProvider } from '../lib/socialAuth';

/* Sized per glyph rather than one number: Ionicons draws the Apple mark with
   more optical weight than the Google G, so a shared size makes Apple look
   the larger of the two sitting side by side. */
const PROVIDERS: Array<{ id: SocialProvider; label: string; icon: keyof typeof Ionicons.glyphMap; size: number }> = [
  { id: 'apple', label: 'Apple', icon: 'logo-apple', size: 19 },
  { id: 'google', label: 'Google', icon: 'logo-google', size: 17 },
];

export function SocialAuthButtons({ onError }: { onError?: (message: string) => void }) {
  /* Hooks first, unconditionally. The flag check used to sit above useTheme,
     which is a conditional hook call — harmless only because the flag is a
     compile-time constant, and a trap the moment it becomes anything else. */
  const { scheme } = useTheme();
  const styles = useMemo(() => makeStyles(), [scheme]);
  const { signInWithSocial } = useAuth();
  const [busy, setBusy] = useState<SocialProvider | null>(null);

  if (!SOCIAL_AUTH_ENABLED) return null;

  const start = async (provider: SocialProvider) => {
    if (busy) return;
    setBusy(provider);
    onError?.('');
    try {
      const result = await signInWithSocial(provider);
      /* 'cancelled' says nothing. Dismissing the sheet is a decision, and
         red text after it reads as "something broke" to somebody who simply
         changed their mind. On success the auth listener navigates. */
      if (result.status === 'error') onError?.(result.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={styles.socialRow}>
        {PROVIDERS.map(provider => {
          const thisBusy = busy === provider.id;
          /* Disabled while the OTHER one is running, so a double tap cannot
             open two authorisation sessions at once — the second would race
             the first's PKCE verifier and fail in a way nobody could explain. */
          const blocked = busy !== null && !thisBusy;
          return (
            <TouchableOpacity
              key={provider.id}
              onPress={() => start(provider.id)}
              disabled={busy !== null}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ disabled: busy !== null, busy: thisBusy }}
              accessibilityLabel={`Continue with ${provider.label}`}
              style={[styles.socialBtn, blocked && styles.socialBtnBlocked]}
            >
              {thisBusy ? (
                <ActivityIndicator size="small" color={colors.ink} />
              ) : (
                <>
                  <Ionicons name={provider.icon} size={provider.size} color={colors.ink} />
                  <Text style={styles.socialText}>{provider.label}</Text>
                </>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
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
  },
  /* Dimmed only while the other provider is mid-flight — not a resting state. */
  socialBtnBlocked: { opacity: 0.5 },
  socialText: { fontFamily: font.bold, fontSize: 14.5, color: colors.ink },
});

export default SocialAuthButtons;
