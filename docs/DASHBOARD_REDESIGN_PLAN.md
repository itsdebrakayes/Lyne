# Dashboard Redesign Plan — "Obvious in Five Seconds"

Source: design review feedback (lecturer, Jul 2026) + our extensions.
Companion to `PRODUCT_VISION.md`. This plan governs the admin dashboards
(executive, manager, staff, + proposed supervisor) and, by principle, the
mobile app.

---

## 1 · The North Star

**A non-technical business owner must look at any screen and, within seconds,
know (a) what it's telling them, (b) why it matters to their business today,
and (c) what to do about it — without hovering, clicking, or being trained.**

The product's value must be self-evident: the dashboard *is* the sales pitch.

## 2 · The Ten Rules (apply to every screen, admin and mobile)

1. **Business language, never system language.** Name things the way a branch
   owner speaks: "Customers served", "Busy times", "What to improve" — never
   "Analytic View", "Queue Volume", "Pipeline", "Notebook".
2. **Most important, top-left.** People read left→right, top→bottom. The data
   someone needs daily goes first; secondary detail flows down and right.
3. **A week by default.** Overviews show *this week* (live ops show today).
   Deeper views go up to a month, never more; months are paged (‹ June · July ›).
4. **Every chart explains itself.** On-chart legend in plain words, readable
   date labels ("Jun 19", "Mon"), units on axes, and a one-line caption saying
   what the chart means for the business. Hover adds detail; it never *carries*
   the meaning.
5. **Numbers before percentages.** A rate never appears without its base:
   "142 of 195 visitors served · 73%". Pick one primary format per card.
6. **Freshness is always visible.** Every analytics surface shows "Updated 32
   minutes ago" (relative time) with an **Update now** button beside it —
   "update", not "refresh". Data auto-updates every 2 hours.
7. **Room to breathe.** Scrollable pages, full-width cards that can grow.
   Nothing squeezed to fit one viewport; nothing tiny.
8. **Distinct, purposeful color.** A named chart palette where each series is
   clearly distinguishable and consistent across screens (same metric = same
   color everywhere). Eye-catching, not decorative.
9. **Actionable beats descriptive.** Recommendations ("move one person to
   Counter 3") lead; raw history supports.
10. **Everything works.** No dead filters, no tabs that dump you somewhere
    else, no empty sections. If a control exists, it does something.

## 3 · Cross-cutting workstreams

### W1 — Freshness system (auto-update + Update now)
- Backend: scheduled job (node-cron in the API) triggers the analytics
  pipeline per business **every 2 hours**; store completed_at.
- Every dashboard header (exec + manager): left of the button, relative
  timestamp — "Updated just now / 32 minutes ago / an hour ago"; then the
  **Update now** button. Wording exactly that.
- Framing per the review: this is "when the system last recalculated your
  numbers" — one line of microcopy on hover/first-run explains it.
- Remove "Insight Freshness / Pipeline" jargon panels; this bar replaces them.

### W2 — Chart system overhaul (one shared kit)
- Build a small chart kit on **recharts** (already in the stack) used by every
  graph: readable date formatting ("Jun 19", weekday letters for week view),
  plain-word legends always visible, units, business captions, empty states.
- **Palette tokens** (distinct series colors used consistently):
  navy `#1F3442` · cyan `#1fc2de` · green `#2fbf71` · amber `#f5a623` ·
  purple `#7a5cf0` · coral `#e5484d` — plus tints for fills.
- Replace the unreadable dense bar "histograph" charts (Analytic View, Queue
  Volume) with **clean line/area charts at weekly granularity** (7 points, not
  90), with the two compared series visibly labeled (e.g. "Customers" vs
  "Average wait").
- **Pie/donut research task:** survey well-executed recharts donut patterns
  (rounded segments, center KPI label, direct segment labels) in OSS repos
  (tremor, shadcn charts, recharts examples) and adopt one pattern that
  matches our aesthetic; use for share-type data (service mix, no-show split).
- **Per-graph time filter** on Statistics: Today · This week · 2 weeks ·
  Month (with month pager ‹ › ). Filter lives on each graph, defaults weekly.

### W3 — Naming glossary (rename across the app)
| Today | Becomes |
|---|---|
| Analytic View | **Your week at a glance** |
| Queue Volume | **Customers per day** |
| Visitor Trend | **Customer visits** |
| Branch Resource Allocation | **Who's needed where** (staffing suggestions) |
| Whole Branch Average | **Estimated wait for service** (branch-wide) |
| Turnover Rate (alone) | **Completed visits — X of Y · Z%** |
| Action Plan | **What to improve** |
| Refresh Analytics | **Update now** |
| Insight Freshness / Pipeline | (removed — replaced by the freshness bar) |
| Heatmap | **Busy times** |
| Notebook insights | (dissolved into Statistics as readable graphs) |
| 06-19 date labels | "Jun 19" / "Mon" |
- Also: audit the two fields both named "branch business" (different
  purposes) and rename each for what it actually is.
- Sweep every eyebrow/label for jargon ("Model Output", "Notebook 05",
  "Derived", "Signal") → business words or deletion.

### W4 — Layout: room to breathe
- Exec overview becomes **scrollable like the manager's** (already unlocked
  from the viewport; now let sections take full width and height as needed).
- Managers tab, Branches tab, Services tab, staff lists: **full-fledged big
  cards** with the score breakdown shown (what made this manager's 62?),
  not micro-rows. Fill the space; scroll when windowed.

## 4 · Executive dashboard

1. **Overview** (top → bottom, after the freshness bar):
   - KPI row (kept, renamed per glossary, numbers-first).
   - **What to improve** card takes the calendar's slot (calendar goes; it
     earns nothing). Shows the top 2–3 recommendations, each mapped to the
     target it serves: "Target: 20 min average wait · You're at 34 · Do X."
     Click-through to the full page.
   - "Your week at a glance": weekly line/area chart (7 points), on-chart
     legend, palette colors, caption.
   - Branch demand (dot matrix — approved, stays), manager scores (bigger).
2. **Statistics**: every overview graph reappears here, larger, each with its
   own time filter; **all notebook insights move here as real graphs**
   (wait forecast, busy-times, staffing suggestions, balking) with business
   names. Nothing lives only in a hover or a "review" blob.
3. **Heatmap tab → "Busy times"**: unify on the manager-style dot matrix,
   week view with week paging (‹ this week ›) and a monthly toggle.
4. **Managers / Branches / Services tabs**: big cards, visible score
   breakdowns, more per-entity detail (use the space).
5. **Operations tab**: currently near-empty — fold live queues into Overview
   and repurpose Operations as **Settings** (targets, hours, business info)…
   which also fixes:
6. **Sidebar bugs**: Settings → a real Settings screen; Support → a real
   Support screen (help + contact, mirroring the mobile help centre);
   nothing routes to Operations as a dumping ground.
7. **Reports**: remove the notebook-insights list. The page shows a **clean
   preview of the actual report** (what the export will contain) +
   **Export as Word (.docx)** (client-side `docx` package). Action-plan
   content appears under its new name.

## 5 · Manager dashboard

1. **Top KPI row**: keep only daily-essential numbers, renamed:
   - "Waiting now", "Estimated wait for service", "Completed visits —
     X of Y · Z%", "No-shows today". (More than four allowed if daily-relevant.)
2. **"Who's needed where"** (was Branch Resource Allocation): rebuild as a
   plain recommendation list/simple bars — "Passport Renewal needs 2 staff
   between 10–12" — not an abstract graph.
3. **Managers get the executive toolkit, branch-scoped:**
   - **Set targets for their branch** (branch-level targets table + API
     scoping; exec targets remain business-wide).
   - **What to improve** (action plan) for their branch.
   - Predictive insights (staffing suggestions, busy times) — decision tools.
   - Report preview + Word export for their branch.
4. **Fix the service filter** (top "All Services" dropdown must actually
   re-scope every panel; some ignore it today) — same fix on staff view.
5. Same chart kit, naming, freshness bar, big cards, weekly defaults.

## 6 · Staff dashboard

- Flow approved — keep. Apply only: bigger type/cards where small, working
  filters, glossary renames where they leak in (e.g. period labels).

## 7 · Supervisor (new intermediate role) — RECOMMENDATION

Real orgs have a between-person: runs people day-to-day, doesn't set branch
strategy. Groundwork exists: Supabase already has `section_manager` in its
role enum; MySQL `roles` doesn't yet.

**Recommendation: yes, add it — as a scoped variant, not a fourth codebase.**
- Role: `supervisor` (label "Supervisor"; maps to section_manager).
- Sees: their section's live queues + staff presence + today/week stats +
  reassign staff between counters in their section.
- Does NOT see: branch targets, branch-wide analytics, reports.
- Build as a permission-scoped version of the manager dashboard (hide the
  strategy panels), not a new app — cheap to build, honest to the hierarchy.
- Requires: roles row + invite-flow option (managers can invite supervisors),
  tenant-access rules (section scope), dashboard routing.

## 8 · Bug list (fix regardless of redesign)

- [ ] "All Services" filter is a no-op on several manager/staff panels.
- [ ] Exec sidebar Settings → Operations (wrong); Support → Operations (wrong).
- [ ] Operations tab effectively empty.
- [ ] Notebook "Review" links go nowhere.
- [ ] Date labels unreadable (06-19 style) everywhere they appear.
- [ ] Percentage-without-base metrics (Turnover 73%, walk-away %).

### W5 — Mobile-on-the-go admin (dashboards on the executive's phone)
Raised in the design review: executives should be able to check the business
from their phone. Approach (per Debra's method): **dedicated mobile variations
of each screen** — purpose-designed layouts per viewport, not fluid
auto-adaptation. Architecture: the admin app is already a web app (Electron
wraps it); once hosted, the same secured app serves phones as an installable
PWA — **no admin screens ever enter the consumer mobile app**, preserving the
strict surface separation. Scope the on-the-go set first: exec overview
(KPIs + What To Improve + freshness), live queues, Busy Times, manager
overview; desktop-only depth (reports, settings) can stay desktop. Build after
P3–P5 stabilize the screens (no point designing mobile variants of layouts
about to change). Design references from Debra before this phase starts.

## 9 · Mobile app follow-through

Apply Rules 1–10 in a sweep: plain-language labels ("Busy times" naming for
Plan-Your-Visit sections), numbers-with-base where rates appear, freshness
copy on prediction cards ("From the last 90 days of real visits" — already
good), readable dates, filters that work. (Mobile is already closest to the
bar; this is a polish pass, not an overhaul.)

## 10 · Phasing

| Phase | Scope | Size |
|---|---|---|
| **P1** | Bug list (§8) + naming glossary sweep (W3) + date formatting | S — fast, huge perceived lift |
| **P2** | Freshness system (W1): cron auto-update, freshness bar, Update now | M |
| **P3** | Chart kit (W2): palette, legends, weekly defaults, per-graph filters, pie/donut pattern, replace Analytic View + Queue Volume | L |
| **P4** | Exec overhaul (§4): What-to-improve placement, statistics absorb notebook insights, busy-times unification, big cards, Settings/Support screens, Reports preview + Word export | L |
| **P5** | Manager overhaul (§5): branch targets + action plan + insights, Who's-needed-where, filter fixes | M–L |
| **P6** | Supervisor role (§7) + mobile polish pass (§9) | M |
| **P7** | Mobile-on-the-go admin variants (W5) — after screens stabilize; needs design references | M–L |

Each phase ships committed to demo → synced to main (no demo data), verified
in the logged-in preview before hand-off.
