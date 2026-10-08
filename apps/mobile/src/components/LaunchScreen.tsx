/**
 * LaunchScreen — the animated splash, from the "Lyne Splash" design.
 *
 * The brand mark assembles itself, then the lockup settles:
 *
 *   Posts     0.00–0.55  two stanchions rise and their finials pop on
 *   Rope      0.55–1.00  the rope draws across and swings into its sag
 *   Queue     1.00–1.95  three people hop into line, front of the line first
 *   Wordmark  1.95–2.85  the camera pulls back as "Lyne" wipes in
 *   Tagline   2.85–3.95  "Spend less time waiting." rises word by word
 *   Out       3.95–4.35  the lockup fades to the background
 *
 * Geometry, colours, easing and timings are the design's own
 * (lyne-splash.jsx), drawn in its 1398 x 666 lockup units and its
 * 1080 x 1920 stage, which is scaled to fit whatever screen this is, phone or
 * iPad, so the framing is the same everywhere. One shared clock drives every
 * part on the UI thread.
 *
 * It takes over from the native splash, which is the same navy with nothing
 * on it (the animation starts from an empty stage), so the handoff is
 * invisible. Under Reduce Motion it is a short fade of the finished lockup.
 */
import React, { useEffect } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing, ReduceMotion, runOnJS, useAnimatedProps, useAnimatedStyle, useReducedMotion,
  useSharedValue, withTiming, type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

const BG = '#0C1B40';
const INK = '#FFFFFF';
const BLUE_A = '#3370FF';
const BLUE_B = '#84D2FF';
const TAGLINE = '#AFC3EA';
const WORDMARK_FONT = 'CormorantGaramond_500Medium_Italic';

// Scene starts (seconds) and the total, from the design's OM_SCENES.
const CUES = { Posts: 0, Rope: 0.55, Queue: 1.0, Wordmark: 1.95, Tagline: 2.85, Out: 3.95 };
const TOTAL = 4.35;

const STAGE_W = 1080;
const STAGE_H = 1920;
const LOCKUP_W = 1398;
const LOCKUP_H = 666;
const HEADS = [170, 242, 314];

// ── the design's easing, as worklets ───────────────────────────────────────
function clamp(v: number, lo: number, hi: number) { 'worklet'; return Math.min(hi, Math.max(lo, v)); }
function easeOutCubic(t: number) { 'worklet'; return 1 - Math.pow(1 - t, 3); }
function easeInOutCubic(t: number) { 'worklet'; return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1; }
function easeOutBack(t: number) { 'worklet'; const c1 = 1.70158; const c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
function tween(T: number, from: number, to: number, start: number, end: number, ease: (t: number) => number) {
  'worklet';
  const p = clamp((T - start) / (end - start), 0, 1);
  return from + (to - from) * ease(p);
}
const enter = (T: number, a: number, b: number, s: number, e: number) => { 'worklet'; return tween(T, a, b, s, e, easeOutCubic); };
const draw = (T: number, a: number, b: number, s: number, e: number) => { 'worklet'; return tween(T, a, b, s, e, easeInOutCubic); };
const pop = (T: number, a: number, b: number, s: number, e: number) => { 'worklet'; return tween(T, a, b, s, e, easeOutBack); };

type Clock = SharedValue<number>;

// ── the mark ───────────────────────────────────────────────────────────────
function Person({ T, cx, start, k }: { T: Clock; cx: number; start: number; k: number }) {
  const style = useAnimatedStyle(() => {
    const t = T.value;
    const x = enter(t, -520, 0, start, start + 0.5);
    const op = enter(t, 0, 1, start, start + 0.25);
    const travel = clamp((t - start) / 0.5, 0, 1);
    const hop = travel < 1 ? -Math.abs(Math.sin(travel * Math.PI * 2)) * 14 * (1 - travel) : 0;
    const land = pop(t, 0, 1, start + 0.42, start + 0.72);
    const squash = t > start + 0.42 ? 1 - 0.06 * Math.sin(land * Math.PI) : 1;
    return {
      opacity: op,
      transform: [{ translateX: x * k }, { translateY: hop * k }, { scaleX: 2 - squash }, { scaleY: squash }],
    };
  });
  // Bounding box of one figure: x cx-33..cx+33, y 53..383 (head top to foot).
  const L = cx - 33;
  const box = (x: number, y: number, w: number, h: number, r: number) => ({
    position: 'absolute' as const, left: (x - L) * k, top: (y - 53) * k, width: w * k, height: h * k, borderRadius: r * k, backgroundColor: INK,
  });
  return (
    <Animated.View style={[{ position: 'absolute', left: L * k, top: 53 * k, width: 66 * k, height: 330 * k, transformOrigin: 'bottom' }, style]}>
      <View style={box(cx - 33, 53, 66, 66, 33)} />
      <View style={box(cx - 33, 124, 66, 128, 22)} />
      <View style={box(cx - 23, 232, 18, 151, 4)} />
      <View style={box(cx - 23, 370, 45, 13, 6.5)} />
    </Animated.View>
  );
}

function Stanchion({ T, x, color, start, k }: { T: Clock; x: number; color: string; start: number; k: number }) {
  const baseStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: pop(T.value, 0, 1, start, start + 0.25) }] }));
  const postStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: enter(T.value, 0, 1, start, start + 0.35) }] }));
  const ballStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop(T.value, 0, 1, start + 0.25, start + 0.5) }] }));
  return (
    <>
      <Animated.View style={[{ position: 'absolute', left: (x - 30) * k, top: 368 * k, width: 60 * k, height: 15 * k, borderRadius: 7.5 * k, backgroundColor: color }, baseStyle]} />
      <Animated.View style={[{ position: 'absolute', left: (x - 8) * k, top: 225 * k, width: 16 * k, height: 150 * k, borderRadius: 4 * k, backgroundColor: color, transformOrigin: 'bottom' }, postStyle]} />
      <Animated.View style={[{ position: 'absolute', left: (x - 15) * k, top: 203 * k, width: 30 * k, height: 30 * k, borderRadius: 15 * k, backgroundColor: color }, ballStyle]} />
    </>
  );
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

function Rope({ T, k }: { T: Clock; k: number }) {
  const props = useAnimatedProps(() => {
    const drawn = draw(T.value, 0, 1, CUES.Rope, CUES.Rope + 0.4);
    const sag = pop(T.value, 10, 58, CUES.Rope + 0.1, CUES.Rope + 0.6);
    const cy = 240 + sag * 2;
    // react-native-svg has no pathLength, so measure the curve and dash by its real length.
    let length = 0;
    let px = 88;
    let py = 240;
    for (let i = 1; i <= 24; i++) {
      const u = i / 24;
      const x = (1 - u) * (1 - u) * 88 + 2 * (1 - u) * u * 243 + u * u * 398;
      const y = (1 - u) * (1 - u) * 240 + 2 * (1 - u) * u * cy + u * u * 240;
      length += Math.hypot(x - px, y - py);
      px = x; py = y;
    }
    return {
      d: `M88 240 Q243 ${cy} 398 240`,
      strokeDasharray: [length, length],
      strokeDashoffset: length * (1 - drawn),
      opacity: drawn > 0 ? 1 : 0,
    };
  });
  return (
    <Svg width={LOCKUP_W * k} height={LOCKUP_H * k} viewBox={`0 0 ${LOCKUP_W} ${LOCKUP_H}`} style={{ position: 'absolute', left: 0, top: 0 }}>
      <Defs>
        <LinearGradient id="lyneRope" gradientUnits="userSpaceOnUse" x1="88" y1="0" x2="398" y2="0">
          <Stop offset="0" stopColor={BLUE_A} />
          <Stop offset="1" stopColor={BLUE_B} />
        </LinearGradient>
      </Defs>
      <AnimatedPath animatedProps={props} fill="none" stroke="url(#lyneRope)" strokeWidth={14} strokeLinecap="round" />
    </Svg>
  );
}

// ── the words ──────────────────────────────────────────────────────────────
function Wordmark({ T, k }: { T: Clock; k: number }) {
  // The wipe: a window that opens left to right over the word, as the design's clip-path does.
  const WIDTH = 940;
  const clip = useAnimatedStyle(() => ({ width: (draw(T.value, 0, 100, CUES.Wordmark + 0.05, CUES.Wordmark + 0.7) / 100) * (WIDTH + 60) * k }));
  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: enter(T.value, -60, 0, CUES.Wordmark + 0.05, CUES.Wordmark + 0.8) * k }] }));
  return (
    <Animated.View style={[{ position: 'absolute', left: (452 - 50) * k, top: -60 * k, height: 640 * k, overflow: 'hidden' }, clip]}>
      <Animated.Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[{ position: 'absolute', left: 50 * k, top: 0, width: WIDTH * k, fontFamily: WORDMARK_FONT, fontSize: 520 * k, lineHeight: 600 * k, color: INK, letterSpacing: -5.2 * k }, slide]}
      >
        Lyne
      </Animated.Text>
    </Animated.View>
  );
}

function TaglineWord({ T, word, index, k }: { T: Clock; word: string; index: number; k: number }) {
  const s = CUES.Tagline + index * 0.1;
  const style = useAnimatedStyle(() => ({
    opacity: enter(T.value, 0, 1, s, s + 0.35),
    transform: [{ translateY: enter(T.value, 24, 0, s, s + 0.45) * k }],
  }));
  return (
    <Animated.Text allowFontScaling={false} style={[{ fontFamily: WORDMARK_FONT, fontSize: 86 * k, lineHeight: 100 * k, color: TAGLINE }, style]}>
      {word}
    </Animated.Text>
  );
}

// ── the stage ──────────────────────────────────────────────────────────────
export default function LaunchScreen({ onDone, onFirstLayout }: { onDone?: () => void; onFirstLayout?: () => void }) {
  const { width: W, height: H } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  // The design's portrait stage, fitted to the screen (an iPad gets the same framing, not a giant logo).
  const k = Math.min(W / STAGE_W, H / STAGE_H);
  const T = useSharedValue(reduceMotion ? CUES.Tagline + 1.0 : 0);
  const fade = useSharedValue(reduceMotion ? 0 : 1);

  useEffect(() => {
    const finish = (ok?: boolean) => { 'worklet'; if (ok && onDone) runOnJS(onDone)(); };
    if (reduceMotion) {
      // The finished lockup, faded in and out. Nothing moves.
      fade.value = withTiming(1, { duration: 300, reduceMotion: ReduceMotion.Never }, () => {
        fade.value = withTiming(0, { duration: 300, reduceMotion: ReduceMotion.Never }, finish);
      });
      return;
    }
    T.value = withTiming(TOTAL, { duration: TOTAL * 1000, easing: Easing.linear, reduceMotion: ReduceMotion.Never }, finish);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const camera = useAnimatedStyle(() => {
    const t = T.value;
    // Icon alone, centred and large, pulling back to the full lockup.
    const settle = draw(t, 0, 1, CUES.Wordmark - 0.1, CUES.Wordmark + 0.65);
    const scale = 1.25 + (0.7 - 1.25) * settle;
    const offX = (699 - 242) * (1 - settle);
    const offY = (333 - 218) * (1 - settle) - 20 * settle;
    const drift = 1 + 0.02 * clamp((t - CUES.Wordmark) / 3, 0, 1);
    const outOp = draw(t, 1, 0, CUES.Out, CUES.Out + 0.35);
    const outScale = draw(t, 1, 1.04, CUES.Out, CUES.Out + 0.35);
    return {
      opacity: outOp * fade.value,
      transform: [{ scale: scale * drift * outScale }, { translateX: offX * k }, { translateY: offY * k }],
    };
  });

  return (
    <View
      style={{ flex: 1, backgroundColor: BG, overflow: 'hidden' }}
      onLayout={onFirstLayout}
      accessibilityRole="image"
      accessibilityLabel="Lyne. Spend less time waiting."
    >
      <Animated.View
        pointerEvents="none"
        style={[{
          position: 'absolute', width: LOCKUP_W * k, height: LOCKUP_H * k,
          left: W / 2 - (LOCKUP_W * k) / 2, top: H * 0.47 - (LOCKUP_H * k) / 2,
        }, camera]}
      >
        {HEADS.map((cx, i) => (
          <Person key={cx} T={T} cx={cx} k={k} start={CUES.Queue + (HEADS.length - 1 - i) * 0.18} />
        ))}
        <Stanchion T={T} x={78} color={BLUE_A} start={CUES.Posts} k={k} />
        <Stanchion T={T} x={407} color={BLUE_B} start={CUES.Posts + 0.12} k={k} />
        <Rope T={T} k={k} />
        <Wordmark T={T} k={k} />
        <View style={{ position: 'absolute', left: 462 * k, top: 520 * k, flexDirection: 'row', gap: 22 * k }}>
          {['Spend', 'less', 'time', 'waiting.'].map((w, i) => <TaglineWord key={w} T={T} word={w} index={i} k={k} />)}
        </View>
      </Animated.View>
    </View>
  );
}
