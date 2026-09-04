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
