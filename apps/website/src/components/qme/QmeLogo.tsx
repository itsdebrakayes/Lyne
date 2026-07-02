import { Link } from "react-router-dom";

export function QmeLogo({
  className = "",
  showText = true,
  dark = false,
}: {
  className?: string;
  showText?: boolean;
  dark?: boolean;
}) {
  return (
    <Link to="/" className={`flex items-center gap-2.5 ${className}`}>
      <span className="relative grid h-8 w-8 place-items-center rounded-xl gradient-purple shadow-[0_6px_18px_-6px_rgba(123,95,255,0.8)]">
        <span className="absolute inset-[6px] rounded-md border-2 border-white/80" />
        <span className="absolute h-2 w-2 rounded-full bg-white" />
      </span>
      {showText && (
        <span
          className={`text-[17px] font-extrabold tracking-tight ${
            dark ? "text-qme-ink" : "text-white"
          }`}
        >
          QME<span className="text-qme-purple"> Now</span>
        </span>
      )}
    </Link>
  );
}
