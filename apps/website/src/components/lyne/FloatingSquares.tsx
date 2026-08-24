import { useEffect, useRef, type ReactNode } from "react";
import { Clock, Bell, QrCode, Sparkles } from "lucide-react";

type Sq = {
  cls: string;
  size: number;
  pos: { top?: string; left?: string; right?: string; bottom?: string };
  dur: number;
  delay: number;
  mx: number;
  my: number;
  icon?: ReactNode;
};

const squares: Sq[] = [
  { cls: "sq1", size: 64, pos: { top: "40%", left: "8%" }, dur: 5.0, delay: 0, mx: 16, my: 16, icon: <Clock className="h-5 w-5 text-lyne-lavender/80" /> },
  { cls: "sq2", size: 44, pos: { top: "64%", left: "5%" }, dur: 6.5, delay: 1.0, mx: -12, my: -12 },
  { cls: "sq3", size: 36, pos: { top: "78%", left: "14%" }, dur: 7.0, delay: 0.5, mx: 10, my: 18, icon: <Bell className="h-4 w-4 text-lyne-lavender/80" /> },
  { cls: "sq4", size: 58, pos: { top: "42%", right: "9%" }, dur: 5.5, delay: 0.8, mx: -16, my: 12, icon: <QrCode className="h-5 w-5 text-lyne-lavender/80" /> },
  { cls: "sq5", size: 40, pos: { top: "70%", right: "7%" }, dur: 6.0, delay: 1.3, mx: 14, my: -14, icon: <Sparkles className="h-4 w-4 text-lyne-lavender/80" /> },
];

export function FloatingSquares({ reduced = false }: { reduced?: boolean }) {
  const list = reduced ? [squares[0], squares[3], squares[4]] : squares;
  const refs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    let raf = 0;
    let tx = 0,
      ty = 0;
    const targets = list.map(() => ({ x: 0, y: 0, cx: 0, cy: 0 }));

    const onMove = (e: MouseEvent) => {
      tx = e.clientX / window.innerWidth - 0.5;
      ty = e.clientY / window.innerHeight - 0.5;
    };

    const tick = () => {
      list.forEach((s, i) => {
        const t = targets[i];
        t.x = tx * s.mx;
        t.y = ty * s.my;
        t.cx += (t.x - t.cx) * 0.08;
        t.cy += (t.y - t.cy) * 0.08;
        const el = refs.current[i];
        if (el) {
          el.style.setProperty("--mx", `${t.cx}px`);
          el.style.setProperty("--my", `${t.cy}px`);
        }
      });
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove);
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [list]);

  return (
    <>
      {list.map((s, i) => (
        <div
          key={s.cls}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className="float-sq pointer-events-none absolute z-0 hidden items-center justify-center md:flex"
          style={{
            width: s.size,
            height: s.size,
            ...s.pos,
            animation: `sq-float ${s.dur}s ease-in-out ${s.delay}s infinite`,
          }}
        >
          {s.icon}
        </div>
      ))}
    </>
  );
}
