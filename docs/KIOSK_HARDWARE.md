# The kiosk — what it is now, what you want, and how to get there

**Created:** 2026-08-18

---

## 1. First: where "the clerk writes the number on a slip" came from

You are right that this is not what you asked for, and it is worth being precise
about what happened, because it is a design decision that got made by default
rather than by anyone choosing it.

The `kiosk_clerk` role as built is **not a self-service kiosk**. It is a
*staffed intake console*: a member of staff logs in on a phone or iPad, and adds
walk-in customers to the line **on their behalf**. That is what the code does,
and the root README documents it that way:

> `kiosk_clerk` — Branch-scoped intake account: logs in on a phone/iPad and adds
> **walk-in** customers to the line on their behalf.

Given that model, and given that nobody built printing, the only way a walk-in
customer leaves with their number is if the clerk reads it out or writes it down.
The comment I found was describing that consequence, not proposing it.

So there are two separate problems:

1. **The thing called "kiosk" is a clerk console.** A prospect who hears "kiosk"
   pictures a machine in the lobby. A demo that reveals a staff member with an
   iPad is a credibility problem, and it also undercuts the pitch — the whole
   point is to *remove* the queue-to-join-the-queue.
2. **There is no printing at all**, in either model.

Fixing (2) without fixing (1) would give you a clerk with a printer. What you
described — walk up, touch the screen, take your ticket — needs both.

---

## 2. How code gets onto a kiosk device, in plain terms

The part that surprises people: **our app cannot talk to a thermal printer on its
own.** A React Native / Expo app runs inside a sandbox that has no concept of a
printer. Something has to bridge the two, and that something is native code.

There are three honest routes.

### Route A — All-in-one Android kiosk with a built-in printer  ← recommended

**What you buy:** a single device that is an Android tablet and a thermal printer
in one housing. Sold specifically for queue tickets, ordering and POS. Vendors:
**Sunmi**, **Telpo**, **iMin**. Look for models described as "desktop
self-service terminal" or "queue kiosk" with an integrated 80mm printer.

**How code gets on it:**

1. The device runs ordinary Android, so it installs a normal `.apk`.
2. The printer is reached through a **vendor SDK** — Sunmi, for example, exposes
   printing as an Android service you bind to and call (`printText`,
   `printQRCode`, `cutPaper`).
3. Because that SDK is Java/Kotlin, our Expo app needs a **native module**: a
   small piece of Android code that exposes `print(ticket)` to JavaScript, plus
   an Expo **config plugin** so the module survives `expo prebuild`.
4. That means leaving Expo Go and using **EAS Build / development builds**. This
   is a normal, well-trodden step, but it is a one-way door for the kiosk build:
   you can no longer test the kiosk by scanning a QR code.
5. You install the build once, then lock the device down (§3).

**Why I recommend it:** one power cable, one device to mount, one vendor to call
when it breaks, and the printer is guaranteed to work with the tablet. For a
lobby kiosk this matters more than flexibility.

### Route B — Tablet + separate network printer

**What you buy:** any decent Android tablet or iPad, plus a network-attached
receipt printer — **Epson TM-m30III** or **Star Micronics TSP143** class, with
Ethernet or Wi-Fi.

**How code gets on it:** here is the trick that makes this route attractive —
**the tablet does not print at all.** The printer has its own IP address, so
the *backend* sends it the print job. The tablet stays a thin client that just
says "issue a ticket", and the server does the rest over a TCP socket using
ESC/POS (the receipt-printer command language, effectively universal).

**Why consider it:** no native module, no EAS complexity, and the print path is
testable from your laptop without touching a device. It also survives the tablet
being replaced. **Why not:** two devices, two power supplies, two things to
mount, and a network dependency between them.

### Route C — Windows/Android mini-PC + monitor + printer

Full flexibility, standard OS printing, and the existing **Electron admin app**
could in principle run in kiosk mode. But it is three or four components to buy,
mount, cable and secure. I would only go here if a client insists on their own
standard hardware.

---

## 3. Making it an actual kiosk, not a tablet running an app

This is the part usually forgotten, and it is what separates a demo from
something you can leave in a government lobby.

**Lock the device to one app.** Android calls this **Lock Task Mode** (the
COSU / "dedicated device" pattern). You provision the device as a *device owner*
and the app pins itself to the foreground: no home button, no notification
shade, no browser. Without this, the first curious person exits to Settings.

**Physical security.** Floor stand or bolted counter mount. Cable management so
power and Ethernet are not pullable. Paper compartment reachable by staff but not
the public.

**Accessibility — and for a government client, treat this as mandatory.** Screen
height reachable from a wheelchair, touch targets large enough to hit without
fine motor control, high-contrast text, and no interaction that depends on
hearing. This is also a procurement scoring criterion in many public tenders.

**Auto-recovery.** The app must relaunch on boot and after a crash, so a power
cut does not leave a black screen until somebody notices.

**Paper-out handling.** The kiosk must detect an empty roll and *say so* on
screen, rather than silently issuing tickets nobody receives. The vendor SDKs
expose printer status; this needs to be wired to a visible state and ideally to
the manager's alert feed.

---

## 4. What the self-service screen has to become

The current console assumes a clerk who knows the system. A member of the public
needs something different:

- **No login per customer.** The device stays signed in as the branch; the
  customer never authenticates.
- **Attract screen.** Something inviting when idle, that wakes on touch.
- **Very large targets.** Service selection as big tiles, not a dropdown.
- **Minimal typing.** Name should be optional, or skipped entirely — a walk-in
  ticket does not need a name to hold a place in line. Every required keystroke
  on a public touchscreen costs you completion.
- **Automatic timeout.** If someone walks away mid-flow, return to the attract
  screen after a few seconds, discarding the partial entry.
- **A printed ticket as the end state**, with the number large enough to read at
  arm's length, plus the service, the branch, and the estimated wait.

---

## 5. What I would do, in order

1. **Decide the model** — self-service kiosk, clerk console, or both. They are
   different products and the current one is the clerk console. (My
   recommendation: build self-service, and *keep* the clerk console — a greeter
   with a tablet is genuinely useful at busy branches and for people who need
   help.)
2. **Buy ONE device** of the chosen class and prove the print path end to end
   before ordering per-branch quantities.
3. **Build the print bridge** — native module for Route A, or a backend ESC/POS
   sender for Route B.
4. **Build the self-service screen** as a distinct surface from the clerk
   console.
5. **Lock the device down** and run it in a real lobby for a week before calling
   it done.

Steps 3–5 are real development work. Step 2 is the only one blocked on a
purchase, and it is the one to start now, because everything else can be built
and tested against it.
