# Launch

Getting Lyne into the App Store, onto Google Play, and onto a server people can
reach. Deployment mechanics live one directory up in [`deploy/`](../../deploy/);
this directory is the store side and the order of operations.

| Document | What it covers |
|---|---|
| [checklist.md](checklist.md) | **Start here.** Everything outstanding, blockers first |
| [build-and-submit.md](build-and-submit.md) | EAS setup and the exact build/submit commands for both stores |
| [app-store-listing.md](app-store-listing.md) | Every App Store Connect field, filled in, plus the App Privacy answers |
| [play-store-listing.md](play-store-listing.md) | Every Play Console field, filled in, plus Data safety |
| [screenshots.md](screenshots.md) | Required sizes, the five screenshots to take, and the iPad decision |
| [accounts.md](accounts.md) | The accounts and purchases still outstanding |

## The critical path

Apple and Google are both already in hand, which removes the longest lead times
from the schedule. What remains is genuinely sequential:

```
DNS + droplet + managed database
        ↓
API live on https://api.uselyne.com          ← nothing mobile can ship before this
        ↓
a pilot agency (or a demonstration tenant) in the production database
        ↓                                     ← a reviewer must be able to join a queue
EAS builds → TestFlight / internal track
        ↓
on-device bug sweep on your own phone
        ↓
store listings + screenshots + privacy answers
        ↓
submit
```

The two things most likely to cost a week are not on that line at all, because
they are decisions rather than steps: **what a reviewer sees in an empty
production database**, and **whether the app claims to support iPad**. Both are
covered in [checklist.md](checklist.md), at the top, for that reason.
