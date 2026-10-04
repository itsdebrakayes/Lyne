import { Link } from "react-router-dom";

/**
 * LyneLogo — the actual logo, which this was not.
 *
 * What stood here was a placeholder: a CSS gradient square with a border and a
 * dot inside it, next to the word "Lyne" set in the UI sans with a purple full
 * stop. Nothing in it came from the brand. The mark was invented by the
 * stylesheet, and the name was in the wrong typeface — the wordmark is
 * Cormorant italic, and setting it in a bold sans produces something that is
 * almost the logo, which is worse than something that is obviously not.
 *
 * It is now the real file: the queue mark and the wordmark as one lockup, the
 * same asset the mobile app ships.
 *
 * TWO VARIANTS, because one does not work on both grounds. The marketing header
 * and footer sit on `bg-lyne-night`, so they take the light (white) lockup;
 * `dark` switches to the navy one for a light background. Passing the wrong one
 * is invisible in exactly the worst way — white on white, which is how the
 * light file reads when you open it on its own.
 */
export function LyneLogo({
  className = "",
  showText = true,
  dark = false,
}: {
  className?: string;
  showText?: boolean;
  dark?: boolean;
}) {
  /* showText=false asks for the mark alone — the square symbol, not the
     lockup cropped, which would cut the wordmark off mid-letter. */
  const src = showText
    ? (dark ? "/lyne-logo-dark.png" : "/lyne-logo-light.png")
    : "/lyne-symbol.png";

  return (
    <Link to="/" className={`inline-flex items-center ${className}`} aria-label="Lyne — home">
      <img
        src={src}
        /* The link already names the destination, so the image is decorative
           here; a filled alt would have a screen reader read "Lyne" twice. */
        alt=""
        /* Width is set from the aspect ratio (900x344) rather than left to the
           intrinsic size, so the header does not jump as the image decodes. */
        className={showText ? "h-8 w-[84px] object-contain" : "h-8 w-8 object-contain"}
        width={showText ? 84 : 32}
        height={32}
        loading="eager"
        decoding="async"
      />
    </Link>
  );
}
