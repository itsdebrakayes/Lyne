import { useEffect, useMemo, useState } from 'react';

type Role = 'staff' | 'manager' | 'executive';
type TourStep = { selector: string; title: string; body: string };

const roleSteps: Record<Role, TourStep[]> = {
  staff: [
    { selector: '[data-tour="navigation"]', title: 'Your workspace', body: 'Use this menu to move between your queue, tickets, services, and settings.' },
    { selector: '[data-tour="live-queue"]', title: 'Run the live line', body: 'This area shows the queue you are serving and the current wait at a glance.' },
    { selector: '[data-tour="queue-actions"]', title: 'Serve each visitor', body: 'Call, complete, skip, or record a no-show from these controls.' },
  ],
  manager: [
    { selector: '[data-tour="navigation"]', title: 'Branch operations', body: 'Queues, staff assignments, and branch reports live in this menu.' },
    { selector: '[data-tour="metrics"]', title: 'Live branch health', body: 'These numbers update from real queues and service activity.' },
    { selector: '[data-tour="analytics"]', title: 'Analytics and pipeline', body: 'Review trends and the freshness of notebook-generated insights here.' },
  ],
  executive: [
    { selector: '[data-tour="navigation"]', title: 'Network navigation', body: 'Move between company-wide analytics, branches, staff, and reports.' },
    { selector: '[data-tour="analytics"]', title: 'Business performance', body: 'Compare real visitor, wait-time, and queue trends across the network.' },
    { selector: '[data-tour="insights"]', title: 'Model freshness', body: 'This section shows whether imported notebook insights are current or stale.' },
  ],
};

export default function GuidedTour({ role }: { role: Role }) {
  const steps = useMemo(() => roleSteps[role], [role]);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const storageKey = `Lyne:desktop-tour:${role}:v1`;

  useEffect(() => {
    if (localStorage.getItem(storageKey) !== 'complete') {
      const timer = window.setTimeout(() => setOpen(true), 500);
      return () => window.clearTimeout(timer);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const target = document.querySelector(steps[index].selector);
      if (target instanceof HTMLElement) {
        target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        window.setTimeout(() => setRect(target.getBoundingClientRect()), 220);
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [index, open, steps]);

  const finish = () => {
    localStorage.setItem(storageKey, 'complete');
    setOpen(false);
  };
  if (!open) return null;
  const step = steps[index];
  const tooltipWidth = Math.min(340, Math.max(260, window.innerWidth - 32));
  const tooltipMaxHeight = Math.max(220, window.innerHeight - 32);
  const canPlaceRight = rect ? rect.right + tooltipWidth + 24 <= window.innerWidth : false;
  const preferredTop = rect ? (canPlaceRight ? rect.top + 16 : rect.bottom + 16) : 120;
  const fallbackTop = rect ? rect.top - 220 : 120;
  const tooltipTop = Math.max(16, Math.min(window.innerHeight - 220, preferredTop > window.innerHeight - 220 ? fallbackTop : preferredTop));
  const tooltipLeft = rect
    ? Math.min(window.innerWidth - tooltipWidth - 16, Math.max(16, canPlaceRight ? rect.right + 16 : rect.left))
    : 16;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, pointerEvents: 'none' }} aria-live="polite">
      {rect && <div style={{ position: 'fixed', left: rect.left - 8, top: rect.top - 8, width: rect.width + 16, height: rect.height + 16, borderRadius: 16, border: '3px solid #fff', boxShadow: '0 0 0 9999px rgba(5,5,7,.78)', pointerEvents: 'none', transition: 'all .25s ease' }} />}
      <div role="dialog" aria-label="Dashboard tutorial" style={{ position: 'fixed', top: tooltipTop, left: tooltipLeft, width: tooltipWidth, maxHeight: tooltipMaxHeight, overflowY: 'auto', background: '#fff', color: '#121216', borderRadius: 8, padding: 20, boxShadow: '0 18px 60px rgba(0,0,0,.28)', pointerEvents: 'auto' }}>
        <small style={{ color: '#73737c', fontWeight: 800 }}>STEP {index + 1} OF {steps.length}</small>
        <h2 style={{ margin: '8px 0', fontSize: 20 }}>{step.title}</h2><p style={{ margin: 0, color: '#5f5f68', lineHeight: 1.5 }}>{step.body}</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 }}><button onClick={finish} style={{ border: 0, background: 'transparent', color: '#73737c', cursor: 'pointer' }}>Skip tour</button><button onClick={() => index === steps.length - 1 ? finish() : setIndex(value => value + 1)} style={{ border: 0, borderRadius: 6, background: '#121216', color: '#fff', padding: '10px 16px', fontWeight: 800, cursor: 'pointer' }}>{index === steps.length - 1 ? 'Finish' : 'Next'}</button></div>
      </div>
    </div>
  );
}
