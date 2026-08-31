/**
 * OnboardingSteps — what sits between the welcome and the sign-in form.
 *
 * Three screens that explain the product, then two that ask about the person.
 * They are separate from OnboardingScreen on purpose: that screen is the
 * welcome moment and is finished, so nothing here touches it.
 *
 * The explainers earn their place by answering the three questions somebody has
 * before they will type an email into anything — what does this do, what do I
 * get, and what does it cost me. Each is one idea, one picture, one line. A
 * carousel of six adjectives is the thing people tap Skip on.
 *
 * The questions earn theirs by CHANGING something. Both answers are read back
 * immediately: the city renames the Home header and pre-filters Search, and the
 * sectors order the Home rail. Nothing here is collected "for later" — see
 * lib/preferences.ts.
 *
 * Skip is always visible and never buried. Somebody who wants to get to the
 * queue should not have to answer anything first, and an onboarding that traps
 * people is one they resent before the product has done anything for them.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Platform, ScrollView, Text, TouchableOpacity, View, useWindowDimensions,
} from 'react-native';

/* react-native-web does not commit native-driven opacity, which is how these
   screens ended up frozen part-transparent. Native keeps the native driver. */
const USE_NATIVE_DRIVER = Platform.OS !== 'web';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { activeScheme, colors, font, hexToRgba, radius, shadow, sp } from '../../lib/theme';
import { CITIES, SECTORS, writePreferences } from '../../lib/preferences';

/* ── the pictures ─────────────────────────────────────────────────────────
   Built from primitives rather than shipped as images: they inherit the theme,
   so they follow dark mode for free and never arrive late over a slow
   connection the way a remote asset does. */

/** A branch card with its live wait — the thing you check before leaving. */
function ArtLiveWait() {
  return (
    <View style={{ width: 250, gap: 12 }}>
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: 16, gap: 12, ...shadow.card }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
          <View style={{ width: 42, height: 42, borderRadius: radius.m, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: font.extra, fontSize: 13, color: colors.accentInk }}>TAJ</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ height: 9, width: '78%', borderRadius: 5, backgroundColor: colors.borderSoft }} />
            <View style={{ height: 7, width: '46%', borderRadius: 4, backgroundColor: colors.borderSoft, marginTop: 7 }} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ fontFamily: font.extra, fontSize: 30, color: colors.ink, letterSpacing: -1 }}>12<Text style={{ fontSize: 16 }}>m</Text></Text>
            <Text style={{ fontFamily: font.medium, fontSize: 11.5, color: colors.muted, marginTop: 1 }}>wait right now</Text>
          </View>
          {/* A queue getting shorter, drawn as bars rather than a chart: the
              shape is the message and no axis is needed to read it. */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 40 }}>
            {[34, 28, 30, 22, 16, 12, 9].map((h, i) => (
              <View key={i} style={{ width: 7, height: h, borderRadius: 4, backgroundColor: i === 6 ? colors.accent : colors.borderSoft }} />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

/** A held ticket — the position, and the fact you are not standing there. */
function ArtHoldSpot() {
  return (
    <View style={{ width: 250, alignItems: 'center' }}>
      <View style={{ backgroundColor: colors.dark, borderRadius: radius.xxl, paddingVertical: 24, paddingHorizontal: 26, alignItems: 'center', width: '100%', ...shadow.hero }}>
        <Text style={{ fontFamily: font.bold, fontSize: 11, color: colors.accent, letterSpacing: 1.4 }}>YOUR NUMBER</Text>
        <Text style={{ fontFamily: font.extra, fontSize: 44, color: '#fff', letterSpacing: -1.5, marginTop: 6 }}>TRN-014</Text>
        <View style={{ flexDirection: 'row', gap: 7, marginTop: 16 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: i < 2 ? colors.accent : 'rgba(255,255,255,0.22)' }} />
          ))}
        </View>
        <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: 'rgba(255,255,255,0.72)', marginTop: 14 }}>
          2 people ahead of you
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 16 }}>
        <Ionicons name="home-outline" size={15} color={colors.muted} />
        <Text style={{ fontFamily: font.bold, fontSize: 12.5, color: colors.muted }}>while you stay where you are</Text>
      </View>
    </View>
  );
}

/** The nudge to leave — the part that makes the held spot worth anything. */
function ArtLeaveOnTime() {
  return (
    <View style={{ width: 250, alignItems: 'center', gap: 14 }}>
      <View style={{ width: 118, height: 118, borderRadius: 59, borderWidth: 8, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ position: 'absolute', width: 118, height: 118, borderRadius: 59, borderWidth: 8, borderColor: colors.accent, borderRightColor: 'transparent', borderBottomColor: 'transparent', transform: [{ rotate: '-42deg' }] }} />
        <Text style={{ fontFamily: font.extra, fontSize: 27, color: colors.ink, letterSpacing: -1 }}>18</Text>
        <Text style={{ fontFamily: font.medium, fontSize: 10.5, color: colors.muted, marginTop: -2 }}>min away</Text>
      </View>
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.l, paddingVertical: 13, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 11, ...shadow.card }}>
        <View style={{ width: 32, height: 32, borderRadius: radius.s, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="notifications" size={16} color={colors.accentInk} />
        </View>
        <View>
          <Text style={{ fontFamily: font.extra, fontSize: 13, color: colors.ink }}>Time to head out</Text>
          <Text style={{ fontFamily: font.medium, fontSize: 11.5, color: colors.muted, marginTop: 1 }}>You will arrive as you are called</Text>
        </View>
      </View>
    </View>
  );
}

const EXPLAINERS = [
  {
    art: ArtLiveWait,
    title: 'See the wait\nbefore you go',
    body: 'Every branch shows what the line is actually doing right now — measured from the counters, not guessed.',
  },
  {
    art: ArtHoldSpot,
    title: 'Hold your spot\nfrom your phone',
    body: 'Join the line without standing in it. Your number moves up while you carry on with your morning.',
  },
  {
    art: ArtLeaveOnTime,
    title: 'Leave at\nthe right time',
    body: 'Lyne works out how long you need to get there and tells you when to set off, so you arrive as you are called.',
  },
];

/* ── the flow ─────────────────────────────────────────────────────────── */

type Step = { kind: 'explain'; index: number } | { kind: 'city' } | { kind: 'sectors' };

const STEPS: Step[] = [
  { kind: 'explain', index: 0 },
  { kind: 'explain', index: 1 },
  { kind: 'explain', index: 2 },
  { kind: 'city' },
  { kind: 'sectors' },
];

export default function OnboardingSteps({ onDone }: { onDone: () => void }) {
  const { height } = useWindowDimensions();
  const [step, setStep] = useState(0);
  const [city, setCity] = useState<string | undefined>();
  const [sectors, setSectors] = useState<string[]>([]);
  const fade = useRef(new Animated.Value(1)).current;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  /* Cross-fade rather than cut — but never at the cost of the screen being
     readable.
     Two things were wrong in the first version. It passed useNativeDriver:true,
     which react-native-web does not commit for opacity, so the value stopped
     wherever the animation abandoned it: the setup screens sat at 31% opacity
     permanently, washed out and unreadable, and no later step recovered them.
     And it chained the fade-in inside the fade-out's completion callback, so
     any callback that never arrived stranded the screen invisible.
     Now: the driver matches the platform, and the fade-IN is driven by an
     effect on `step` rather than a callback. The step change is what makes the
     screen appear, so there is no path where the content changes and the
     opacity does not follow. */
  const goTo = (next: number) => {
    Animated.timing(fade, { toValue: 0, duration: 110, useNativeDriver: USE_NATIVE_DRIVER })
      .start(() => setStep(next));
    // Belt and braces: if that callback never lands, the step still advances.
    setTimeout(() => setStep((cur) => (cur === next ? cur : next)), 160);
  };

  useEffect(() => {
    fade.setValue(0);
    const anim = Animated.timing(fade, { toValue: 1, duration: 160, useNativeDriver: USE_NATIVE_DRIVER });
    anim.start();
    /* The screen must end up visible even if the animation is interrupted by a
       fast tap or dropped by the platform. A stuck-invisible screen is a far
       worse outcome than a missing fade. */
    const settle = setTimeout(() => fade.setValue(1), 400);
    return () => { anim.stop(); clearTimeout(settle); };
  }, [step, fade]);

  const finish = async (answers: { city?: string; sectors?: string[] }) => {
    await writePreferences({ ...answers, onboardedAt: new Date().toISOString() });
    onDone();
  };

  const next = () => {
    if (isLast) return finish({ city, sectors: sectors.length ? sectors : undefined });
    goTo(step + 1);
  };

  const back = () => (step === 0 ? onDone() : goTo(step - 1));

  const toggleSector = (key: string) =>
    setSectors((list) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]));

  /* The primary action's label is the next thing that happens, never "Next".
     On the question screens it also has to admit when nothing is selected,
     because a person who skips should not be made to feel they did it wrong. */
  const cta = useMemo(() => {
    if (current.kind === 'explain') return current.index === 2 ? 'Set Lyne up for me' : 'Continue';
    if (current.kind === 'city') return city ? `Yes, ${city}` : 'Choose later';
    return sectors.length ? 'Finish setup' : 'Skip for now';
  }, [current, city, sectors]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Derived from the accent, not a fixed light blue.
          A hardcoded '#e6f0fa' is a pale wash in light mode and a bright band
          across the top of a near-black screen in dark mode — the app's own
          background painted over with somebody else's. Tinting the accent and
          fading it into colors.bg gives the same soft lift in both schemes,
          because both ends now move with the palette. */}
      <LinearGradient
        pointerEvents="none"
        colors={[hexToRgba(colors.accent, activeScheme === 'dark' ? 0.16 : 0.13), colors.bg]}
        locations={[0, 0.55]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: height * 0.5 }}
      />

      {/* top bar — back on the left, skip on the right, both always reachable */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: sp.screen, paddingTop: 58, paddingBottom: 6 }}>
        <TouchableOpacity
          onPress={back}
          accessibilityRole="button"
          accessibilityLabel={step === 0 ? 'Skip setup' : 'Back'}
          hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
          style={{ width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' }}
        >
          <Ionicons name="chevron-back" size={23} color={colors.sub} />
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', gap: 6 }}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === step ? 22 : 7, height: 7, borderRadius: 4,
                backgroundColor: i === step ? colors.accent : colors.border,
              }}
            />
          ))}
        </View>

        <TouchableOpacity
          onPress={() => finish({ city, sectors: sectors.length ? sectors : undefined })}
          accessibilityRole="button"
          accessibilityLabel="Skip setup"
          hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
          style={{ width: 40, height: 40, alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <Text style={{ fontFamily: font.bold, fontSize: 13.5, color: colors.sub }}>Skip</Text>
        </TouchableOpacity>
      </View>

      <Animated.View style={{ flex: 1, opacity: fade }}>
        {current.kind === 'explain' ? (
          <ExplainStep {...EXPLAINERS[current.index]} />
        ) : current.kind === 'city' ? (
          <CityStep value={city} onChange={setCity} />
        ) : (
          <SectorStep values={sectors} onToggle={toggleSector} />
        )}
      </Animated.View>

      <View style={{ paddingHorizontal: sp.screen, paddingBottom: 40 }}>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={next}
          activeOpacity={0.9}
          style={{ backgroundColor: colors.dark, borderRadius: radius.xl, height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, ...shadow.hero }}
        >
          <Text style={{ color: '#fff', fontFamily: font.extra, fontSize: 15.5 }}>{cta}</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.accent} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ExplainStep({ art: Art, title, body }: { art: () => React.JSX.Element; title: string; body: string }) {
  return (
    <View style={{ flex: 1, paddingHorizontal: sp.xxl }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Art />
      </View>
      <View style={{ paddingBottom: sp.xxl }}>
        <Text style={{ fontFamily: font.extra, fontSize: 30, lineHeight: 36, color: colors.ink, letterSpacing: -1 }}>{title}</Text>
        <Text style={{ fontFamily: font.medium, fontSize: 14.5, lineHeight: 22, color: colors.muted, marginTop: 12, maxWidth: 330 }}>{body}</Text>
      </View>
    </View>
  );
}

function StepHead({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ paddingHorizontal: sp.xxl, paddingTop: 14, paddingBottom: 18 }}>
      <Text style={{ fontFamily: font.extra, fontSize: 27, lineHeight: 33, color: colors.ink, letterSpacing: -0.9 }}>{title}</Text>
      <Text style={{ fontFamily: font.medium, fontSize: 14, lineHeight: 21, color: colors.muted, marginTop: 9 }}>{body}</Text>
    </View>
  );
}

function CityStep({ value, onChange }: { value?: string; onChange: (c: string) => void }) {
  return (
    <View style={{ flex: 1 }}>
      <StepHead
        title={'Where do you\nqueue most?'}
        body="We will open on your town and put its branches first. You can change this any time."
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: sp.xxl, paddingBottom: 20, gap: 10 }} showsVerticalScrollIndicator={false}>
        {CITIES.map((c) => {
          const on = value === c;
          return (
            <TouchableOpacity
              key={c}
              onPress={() => onChange(c)}
              activeOpacity={0.85}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={{
                minHeight: 56, borderRadius: radius.l, paddingHorizontal: 18,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                backgroundColor: on ? colors.accent : colors.surface,
                borderWidth: 1, borderColor: on ? colors.accent : colors.border,
                ...(on ? shadow.card : null),
              }}
            >
              <Text style={{ fontFamily: font.extra, fontSize: 15, color: on ? colors.accentInk : colors.ink }}>{c}</Text>
              {/* The tick is the visual confirmation: the row does not merely
                  change colour, it says which one is chosen. */}
              {on ? <Ionicons name="checkmark-circle" size={21} color={colors.accentInk} /> : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function SectorStep({ values, onToggle }: { values: string[]; onToggle: (k: string) => void }) {
  return (
    <View style={{ flex: 1 }}>
      <StepHead
        title={'What brings\nyou to Lyne?'}
        body="Pick as many as you like — we will lead with these on your home screen."
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: sp.xxl, paddingBottom: 20, gap: 11 }} showsVerticalScrollIndicator={false}>
        {SECTORS.map((s) => {
          const on = values.includes(s.key);
          return (
            <TouchableOpacity
              key={s.key}
              onPress={() => onToggle(s.key)}
              activeOpacity={0.85}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              style={{
                minHeight: 74, borderRadius: radius.l, padding: 15,
                flexDirection: 'row', alignItems: 'center', gap: 13,
                backgroundColor: colors.surface,
                borderWidth: on ? 2 : 1,
                borderColor: on ? colors.accent : colors.border,
                ...shadow.card,
              }}
            >
              <View style={{ width: 44, height: 44, borderRadius: radius.m, backgroundColor: on ? colors.accent : colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={s.icon as never} size={21} color={on ? colors.accentInk : colors.sub} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: font.extra, fontSize: 14.5, color: colors.ink }}>{s.label}</Text>
                <Text style={{ fontFamily: font.medium, fontSize: 12, color: colors.muted, marginTop: 2 }}>{s.hint}</Text>
              </View>
              <Ionicons
                name={on ? 'checkmark-circle' : 'ellipse-outline'}
                size={22}
                color={on ? colors.accent : colors.faint}
              />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
