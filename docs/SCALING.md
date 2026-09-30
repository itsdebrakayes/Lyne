# Scaling — what we deliberately did not build, and when to

**Last reviewed:** 29 September 2026, before the first production deploy.

Every item here is a real technique that a larger version of this system would
want. None of them is built, and that is a decision rather than an oversight.

The rule this file exists to enforce: **adopt on a measured trigger, not on
anticipation.** Each entry names the signal that should change the answer. If
the signal has not fired, the answer is still no — a queue platform serving one
agency with five branches is made worse, not better, by infrastructure sized for
a national rollout, because every piece of it is something that can break at
3am and something that has to be paid for monthly.

The opposite failure is real too: reaching the trigger and not noticing. That
is what the signals are for. Check this file whenever a new organisation signs.

---

## 1. Kubernetes

**Today:** Docker Compose on one droplet — Caddy, API, model worker. All three
carry `restart: unless-stopped` and health checks, so a crashed container comes
back on its own. That is the self-healing people usually reach for Kubernetes to
get, at single-machine scale.

**What Kubernetes would add:** scheduling containers across *several* machines,
survival of a whole machine dying, rolling updates without a gap, and horizontal
autoscaling.

**What it costs:** at least two worker nodes (each priced like the droplet we
already run), a load balancer at roughly $12/month, and an operational surface —
manifests, ingress, secrets, RBAC — that one person has to hold in their head
while also selling the product.

**Adopt when any of these is true:**
- One API process can no longer keep up, and vertical resizing of the droplet
  has already been tried. Resizing is a slider; Kubernetes is a migration.
- A few seconds of downtime during a deploy has become unacceptable — a
  contract with an availability clause, for instance.
- Losing the single droplet for an hour would breach an obligation, so a second
  machine has to exist anyway.

**Do not adopt because:** the number of tenants went up. Ten agencies on one
droplet is still one API process. Traffic is the trigger, not customer count.

---

## 2. Token bucket rate limiting, and shared rate-limit state

**Today:** `express-rate-limit` with its default fixed-window counter, held in
memory, in one API process. Authenticated limits are keyed by the signed-in
person (see `actorOrIp` in `apps/backend/src/middleware/rateLimiter.js`);
anonymous ones fall back to IP.

**The two known weaknesses, and why neither bites yet:**

*Fixed windows allow a burst across the boundary.* Somebody can spend a full
window's budget in its last second and a fresh one in the first second of the
next. With our numbers that is 20 login attempts in a moment instead of 10 —
irritating, not a breach. A **token bucket** refills continuously and removes
the boundary entirely, which is the correct algorithm and worth adopting when
the limits start protecting something expensive rather than something merely
abusable.

*In-memory state is per process.* With two API processes each keeps its own
counter, so the effective limit doubles and the limiter quietly stops meaning
what it says. The fix is a shared store — Redis, via `rate-limit-redis`.

**Adopt a shared store the moment there is more than one API process.** That is
a hard trigger, not a judgement call: the day a second instance starts, the
limits are wrong. It is also the same day Kubernetes or a second droplet arrives,
so treat them as one piece of work.

**Adopt token bucket when:** a limit guards real money or a paid third-party
call, and the boundary burst would cost something. `paymentLimiter` is the
first candidate — ten card attempts an hour becomes twenty across a boundary.

---

## 3. Blue-green deployment

**Today:** `docker compose up -d` recreates changed containers — a gap of a few
seconds — then `deploy.sh` polls the API's health endpoint, verifies the public
HTTPS URL answers, and **rolls back to the last commit that passed a health
check** if it does not.

**The hard prerequisite is already satisfied, and must stay that way.** Blue-green
only works if you can run the previous release against the current database, and
that means never dropping or renaming a column in the same release that stops
using it — expand now, contract much later. All 33 migrations to date are purely
additive. That property is what makes our rollback safe too, so it is worth more
than blue-green itself.

**What blue-green would add:** zero downtime, and instant rollback by flipping
traffic rather than rebuilding.

**What it costs:** two complete environments, roughly doubling the hosting bill,
to remove a few seconds of downtime on a deploy whose timing we choose.

**Adopt when:** an availability commitment makes a few seconds at 6am a breach,
or deploys become frequent enough that the accumulated downtime is noticed.
A canary — shifting 5%, then 25%, then everything — is the natural next step
after blue-green, and needs the load balancer that Kubernetes would bring.

---

## 4. A read replica for the database

**Today:** one managed MySQL node serving both the live queue and the analytics
dashboards.

**The pressure is already visible.** The executive dashboard's aggregate queries
measured **3.5–4.7 seconds** in the demo environment. Those run against the same
node that answers "what is my place in the line", so a manager opening Reports
during a busy morning competes with customers.

**A read replica** puts analytics on a second copy, leaving the primary for live
traffic. DigitalOcean offers them on managed MySQL as an in-place addition.

**Adopt when:** live queue endpoints slow measurably while dashboards are in
use, or sustained database CPU passes ~70%. Resize the single node first — it is
cheaper and simpler — and add the replica when a bigger node stops helping,
because at that point the problem is contention rather than capacity.

---

## 5. Cloudflare R2 instead of DigitalOcean Spaces

**Today:** Spaces, for desktop installers and database backups.

R2's advantage is that it does not charge for data leaving it. That matters
enormously for a media platform and almost not at all for us: installers are
downloaded occasionally by an IT officer, and backups are written constantly and
read almost never. Spaces includes 1 TB of outbound transfer, which our workload
will not approach.

**Adopt when:** we start serving large media to end users at volume — video
guides inside the app would be the realistic trigger — or the Spaces egress line
on the bill stops being a rounding error.

---

## 6. A search index

**Today:** `apps/mobile/src/lib/fuzzy.ts` scores every branch on every keystroke,
in the app, with a bounded edit distance. There is no search index and no
`FULLTEXT` index in the schema.

This is correct for roughly thirty branches — the whole list is already in memory
and scoring it costs a fraction of a frame. The textbook answer, a trie walked
with an edit-distance budget, is for a million rows.

**Adopt a real index when:** the searchable list reaches the low thousands, or
search becomes server-side because the client no longer holds every branch.
`FULLTEXT` in MySQL is the cheap next step; a dedicated engine only after that.

---

## The signals worth watching

| Signal | What it changes |
|---|---|
| A second API process exists | Shared rate-limit store, **immediately** |
| Sustained database CPU > 70% | Resize the node; then consider a read replica |
| Live queue endpoints slow while dashboards are open | Read replica |
| Vertical droplet resizing has stopped helping | Multiple machines, then Kubernetes |
| Deploy downtime becomes contractual | Blue-green, then canary |
| Branch list in the thousands | Server-side search and a real index |
| Egress a visible line on the bill | Reconsider R2 |
| **Any destructive migration is proposed** | **Stop.** It breaks rollback — see §3 |
