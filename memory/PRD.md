# Lyne — Product Requirements

## Purpose
A virtual queue, branch-visit and appointment management mobile app for Jamaican public-service organizations (e.g. Tax Administration Jamaica). Customers find services & branches, join virtual lines, reserve capped sessions, follow their turn in real-time, check in on arrival, and get called to a counter.

## Scope of MVP (this build)
Frontend-only high-fidelity prototype with realistic Jamaican mock data. Mocked OTP (any 6-digit code) and in-app notification centre. Sessions tab included. No backend/persistence, no map view, no real push.

## Tech
- Expo Router (file-based) · React Native · TypeScript
- lucide-react-native icons · react-native-svg · @gorhom/bottom-sheet · react-native-safe-area-context
- Local module store (`useSyncExternalStore`) — no backend
- Design tokens from `/app/design_guidelines.json` → `/app/frontend/src/theme.ts`

## Key Screens
- Splash & 3-slide onboarding + auth (phone/email → 6-digit OTP → guest option)
- 5-tab bottom nav: **Home · Find · My Visits · Sessions · Account**
- **Home** — Active ticket hero card (TRN-014, people ahead, ETA, progress), quick actions, nearby branches, upcoming reservation, recent services, advisory
- **Find** — Branch list w/ filter chips (Open now, Shortest wait, Accessible, Sessions), status chips, live waits
- **Branch details** — hours, chips, notice, service list w/ waits, Join-a-line CTA
- **Service details** — description, who, documents, fee/duration, branches available
- **Join-a-line wizard** — 3 steps (branch → review → confirm rules) with progress bar
- **Live Ticket** — 80pt ticket number, live pulse indicator, stats row, 6-step timeline, verification code, contextual check-in, directions/help/cancel
- **Called State** — 96pt "Window TRN-3", 5-min countdown, verification code display, on-my-way/help/can't-make-it
- **Sessions list & details** — capped events (Saturday Traffic Ticket Sitting, GCT Clinic, Senior Filing Day) w/ capacity progress
- **Reservation confirmation** — QR + alphanumeric access code (`W7TH-JCM4`), ref number
- **My Visits** — Active / Upcoming / Past tabs with empty states
- **Notifications** — grouped Today/Earlier
- **Account** — profile card + prefs (Notifications, Saved branches, Accessibility, Language) + Privacy/Help + Sign out
- **Feedback** — 5-star rating + text + report problem
- **Help** — FAQs + contact

## Design System (facelift — Sept 2026)
- Light canvas `#F3F5F9`, white borderless cards w/ soft shadow (radius 20–24); dark "focus" palette for immersive flows (`#0B1424` bg, `#111C2E` cards) — tokens in `src/theme.ts` (`dark`, `shadow`, `type`, `TAB_BAR_CLEARANCE`)
- Royal blue `#1D4ED8` primary, deep navy `#0B192C` brand, coral `#E4572E` warning
- SF-style type scale with tight tracking on display sizes (`type.display/title1/title2/…/eyebrow`)
- Floating pill tab bar (Home · Find · ⚡ · Saved · Account); screens pad bottom by `TAB_BAR_CLEARANCE`
- Status never color-only — every chip pairs icon + label; Lucide icons; 44pt+ touch targets

## Facelift screens (implemented)
- **Sign in / Create account** — light, floating app-icon tile backdrop, dark pill CTA, Apple/Google placeholders, sign-up → OTP → home
- **Home** — avatar + location, "You're in line" strip, display headline, search + filter, chips, agency cards, near-you list
- **Find** — agency list w/ sticky search, Filters/Shortest wait, quick searches, agency cards (tags, Now · N in line, Join, bookmark)
- **Join (dark)** — `join/[id]` "Let's get you in line" (branch/service selectors via bottom sheets, Now/Later, open lines) → `join/line` "The line right now" (counter-dot visualiser, spot/ahead/wait) → `join/ready` "Take your spot from anywhere" (Have-these-ready checklist, hold-to-join)
- **Your ticket (dark)** — white ticket card, perforation + barcode + code, Notify me / Leave queue → "You've left the line" reason sheet; contextual heading-in / checked-in banners; preview control to advance stages
- **Called** — dark canvas, pulsing window card, countdown, code
- Remaining screens (Branch, Service, Sessions, Visits, Account, Notifications, Help, Reservation, Feedback, Welcome) restyled with shared primitives (`ScreenHeader`, `Card`, `Button`)

## Legacy design notes
- Deep navy `#0B192C` brand, Royal blue `#1D4ED8` primary, Soft blue `#E1EFFE`, Pale blue-grey `#F0F4F8` surface, Coral `#E4572E` warning
- Radii 8/14/16/20, 8pt spacing grid
- Status **never** color-only — every chip pairs icon + label
- Lucide outline icons, 44pt+ touch targets

## Business Enhancement (SaaS opportunity)
Sessions system can be sold to government agencies as a paid module for capped clinics, drives, and appointment days — extending customer lifetime value beyond core queue management.

## Next iteration candidates
- Real-time backend (FastAPI + MongoDB + WebSockets for live position updates)
- Emergent-managed push for turn alerts
- Map view w/ react-native-maps
- Multi-org support (branches for different agencies)
