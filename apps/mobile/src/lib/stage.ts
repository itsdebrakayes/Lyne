import { useWindowDimensions } from 'react-native';

/**
 * useStage — how much room this screen actually has, and what to do with it.
 *
 * A phone layout does not become an iPad layout by getting wider. Onboarding
 * was written for a 390pt phone: full-bleed padding, a headline pinned to the
 * bottom, a line of body copy capped at 330pt. On a 1032pt iPad every one of
 * those choices fails differently — the padding stops being a margin, the
 * headline strands itself in a corner, and the capped paragraph sits alone in
 * a third of the screen.
 *
 * So the rule is not "scale everything up". It is: hold the reading column at
 * a sane width, centre it, and let the type grow a step because a tablet is
 * held further away than a phone. That is the same rule the kiosk terminal
 * follows, which is why the two now look like one product.
 *
 * The breakpoint is about reading distance rather than device class — a large
 * phone in landscape gets the wide treatment, and it should.
 */
export function useStage() {
  const { width, height } = useWindowDimensions();
  const wide = width >= 700;

  return {
    wide,
    width,
    height,
    /** Cap for the reading column. Beyond this, lines get too long to track. */
    maxWidth: wide ? 620 : undefined,
    /** Horizontal breathing room outside the column. */
    pad: wide ? 40 : 28,
    /** One step up on a tablet, held at arm's length. */
    title: wide ? 42 : 30,
    titleLine: wide ? 50 : 36,
    body: wide ? 17.5 : 14.5,
    bodyLine: wide ? 27 : 22,
  };
}

export default useStage;

/**
 * The reading column for a scrolling screen.
 *
 * Every customer screen was written against a phone, where "full width" and
 * "the right width" are the same thing. On a 1032pt iPad they stop being the
 * same: the search field becomes a thousand points of empty box, the hero's
 * two buttons stretch to 680 each, and the headline keeps a phone's line break
 * while sitting in a third of the screen. That combination is what App Review
 * means by "designed for iPhone, stretched" — Guideline 4.0.
 *
 * So the content container holds a column and centres it. 780 is wide enough
 * that the agency rails still show what they showed before, and narrow enough
 * that a line of body copy stays readable.
 *
 * Returns null on a phone, so spreading it is a no-op there and no phone
 * layout can be disturbed by a tablet fix.
 */
/* A tablet is not a phone with margins.
 *
 * The first pass at this held a 780pt column and centred it, which fixed the
 * stretched controls and replaced them with something worse: a phone-sized app
 * marooned in the middle of a 1032pt screen with 126pt of nothing down each
 * side. An iPad layout uses the iPad. So the column is now nearly the full
 * width, with margins that read as margins, and the type and controls step up
 * because the device is held further away. */
export const CONTENT_MAX = 1120;
export const TABLET_PAD = 48;

/** True when there is tablet room to work with — a large phone in landscape
 *  counts, and should. */
export function useWide() {
  return useWindowDimensions().width >= 700;
}

export function useContentColumn() {
  const { width } = useWindowDimensions();
  if (width < 700) return null;
  return {
    width: '100%',
    maxWidth: CONTENT_MAX,
    alignSelf: 'center',
    paddingHorizontal: TABLET_PAD,
  } as const;
}

/**
 * The same column, for something that already sits inside its own 20pt of
 * padding — a pinned action bar. Without this the bar centres inside the padded
 * width and lands short of the cards it belongs to, which is the kind of
 * misalignment you cannot unsee once you have seen it.
 */
export function useContentColumnInner() {
  const { width } = useWindowDimensions();
  if (width < 700) return null;
  return {
    width: '100%',
    maxWidth: Math.min(width, CONTENT_MAX) - TABLET_PAD * 2,
    alignSelf: 'center',
  } as const;
}
