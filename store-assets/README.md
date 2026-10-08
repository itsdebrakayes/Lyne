# Store screenshots

Captured from the Lyne mobile app in the iOS Simulator, Release configuration,
against a local API seeded with the Blue Harbour fixture. Everything visible is
invented: Blue Harbour Credit Union is not a real institution, and no real
customer, staff member or ticket appears in any frame.

The order follows `docs/launch/screenshots.md` — the first two carry the set,
so they lead with the problem rather than with a sign-in screen.

| # | Screen | Caption to pair it with |
|---|---|---|
| 01 | Home, live waits across branches | See the wait before you leave home |
| 02 | Ticket — live position in the queue | Hold your spot from anywhere |
| 03 | Ticket — departure reminder | We tell you when to leave |
| 04 | What to bring | Know what to bring |
| 05 | Best time to visit | Go when it is quiet |

## ios-6.9/

1320 × 2868, PNG, **no alpha channel** — App Store Connect rejects a
screenshot that has one outright. Apple scales this class down for smaller
iPhones, so it is the only iPhone set needed.

Captured on **iPhone 16 Pro Max**, not 17 Pro Max: no 17 Pro Max runtime is
installed on this machine, and the two share the same 6.9-inch panel at
exactly 1320 × 2868. The capture is native resolution, never resized — a
resampled screenshot is the usual reason these come out soft.

## ipad-13/

2064 × 2752, same rules. **Required**, because `app.json` sets
`ios.supportsTablet: true` and there is no way to submit without the set.

## Re-capturing

Release build, not Debug. A Debug build embeds no JS bundle, so it needs Metro
running, and Metro's "Refreshing…" banner lands in the frames. Set the status
bar before capturing:

```
xcrun simctl status_bar <udid> override --time "9:41" \
  --batteryState charged --batteryLevel 100 --cellularBars 4
```

That overrides only the displayed clock, not the device clock — so if the
fixture branches look closed, check the real simulator time rather than the
status bar.
