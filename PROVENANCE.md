# Authorship and provenance

**Maintained by:** Debra-Kaye Smith (DKS Technologies)
**Last verified:** 21 August 2026, against the full git history of this repository.

> **Naming note.** This product was renamed to **Lyne** on 21 August 2026. The
> old name and the identifiers below (`qmenow.dev`, `QMeNow`, the 2025 repository
> state) are quoted here **verbatim and deliberately**, because this file is a
> record of what the history contains. They are not stale references and must not
> be renamed — doing so would falsify the evidence.

This file records who has contributed to this codebase and how materially, so
that the record exists and is reproducible rather than reconstructed later from
memory. **Every claim below is a statement about the repository and can be
re-derived with the commands given.** Nothing here is an opinion about anybody.

---

## 1 · Summary

| Author | Commits | Nature |
|---|---|---|
| **Debra-Kaye Smith** (`debra@…`, `debrakayesam@gmail.com`, `itsdebrakayes`) | **259** | Sole human author of the current system |
| `gpt-engineer-app[bot]` | 112 | Lovable, a code-generation tool. **Account under `debrakayesam@gmail.com`, paid subscription.** Output is work product commissioned and directed by Debra. |
| `Manus <manus@qmenow.dev>` | 9 | Manus, an AI agent. **Account under `debrakayesam@gmail.com`, paid subscription.** Same status. |
| `gitcyrnlog <javariwhilby04@gmail.com>` | **1** | A third party. Analysed in §3. **Nothing from it survives.** |

Reproduce:

```bash
git log --all --format='%an <%ae>' | sort | uniq -c | sort -rn
```

The two bot identities are tools, not collaborators. They ran under Debra's own
paid accounts and produced output at her direction, in the same way a compiler
or a design tool does. They are recorded here for completeness because they
appear in the log.

---

## 2 · The system as it exists today post-dates the original project entirely

The repository opens on **18 October 2025** with Lovable-generated commits
building a Vite/React single-page site — a marketing-style front end, at the
repository root in `src/`.

**That is not the product.** The current system is a monorepo of four
applications, none of which existed in 2025:

| Application | First appears |
|---|---|
| `apps/backend` — Node/Express API, MySQL schema, 29 migrations | 30 April 2026 |
| `apps/mobile` — React Native / Expo consumer app | 30 April 2026 |
| `apps/admin-desktop` — React/Electron staff and management app | 1 May 2026 |
| `apps/website` — the marketing site | (rebuilt) |

Reproduce:

```bash
git log --all --diff-filter=A --format='%h %ad %an' --date=short -- apps/backend apps/mobile apps/admin-desktop
```

The original root `src/` tree is gone. The architecture, the data model, the
sector model, the role model and the queue mechanics were all designed and built
after that date.

**Contributor timeline** — the third party appears only in the October 2025
window and never again:

```bash
git log --all --until=2025-10-31 --format='%an' | sort -u   # includes gitcyrnlog
git log --all --since=2025-11-01 --format='%an' | sort -u   # does not
```

---

## 3 · The single third-party commit, in full

**Commit** `90cb589c444aefbfafa7fb2410c91470c794d3fa`
**Author** `gitcyrnlog <javariwhilby04@gmail.com>`
**Date** 18 October 2025, 18:35 −0500
**Subject** `tsx to jsx`
**Scale** 128 files changed, 5,340 insertions, 4,715 deletions

### What it did

It ran an **automated transpiler** across the then-existing front end, converting
TypeScript/JSX to plain JavaScript. The purpose, per Debra, was to make her front
end mesh with a different repository and database the group intended to move it
into.

The output is machine-generated and says so on its face:

| Artefact introduced | Count |
|---|---|
| `_jsxFileName` markers (Babel) | 727 |
| `React.createElement(...)` calls replacing JSX | 662 |
| `__self` / `__source` debug metadata (Babel dev transform) | 660 |

A representative before/after — `src/components/GlassCard.tsx`:

```diff
-import { cn } from "@/lib/utils";
-import { ReactNode } from "react";
-interface GlassCardProps { children: ReactNode; className?: string; … }
-export const GlassCard = ({ children, className, hover = false, … }: GlassCardProps) => {
+const _jsxFileName = "";import React from 'react';
+export const GlassCard = ({ children, className, hover = false, … }) => {
+    React.createElement('div', { className: cn(…), onClick: onClick,
+      style: style, __self: this, __source: {fileName: _jsxFileName, lineNumber: 15}}
```

The component's name, its props, its behaviour, its class names and its structure
are **unchanged** — they are Debra's. What changed is that the type annotations
were deleted and the JSX was mechanically desugared into `React.createElement`
calls, with the transpiler's own debug metadata left in the output.

No feature was added. No logic was altered. The conversion made the code less
readable, which is consistent with it being a build-step artefact rather than
authored work.

The only hand-written files in the commit were six throwaway conversion scripts
(`convert-to-jsx.js`, `cleanup-typescript.js`, `scripts/tsx-to-jsx.mjs`, and
three others). Those are tooling, not product.

### What survives

**Nothing.**

All 128 files touched by that commit — including the six conversion scripts —
have been deleted. None exists in the working tree and none is tracked on any
branch.

Reproduce:

```bash
H=90cb589c444aefbfafa7fb2410c91470c794d3fa
git show --name-only --format="" $H | while read -r f; do
  [ -n "$f" ] && git ls-files --error-unmatch "$f" >/dev/null 2>&1 && echo "SURVIVES: $f"
done
# → no output
```

### Why this is recorded rather than hidden

The commit is in the ancestry of every branch and will remain in the log. Stating
that "nobody else ever contributed" would be contradicted by one line of
`git log` and would weaken an otherwise clear position. The accurate statement is
stronger and is the one to use:

> One commit by a third party exists, dated 18 October 2025. It ran an automated
> TypeScript-to-JavaScript transpiler over machine-generated code, added no
> features and changed no logic, and not one of the 128 files it touched remains
> in the product.

---

## 4 · Origin of the concept

The originating idea — that a person can take a place in a physical queue in
advance and be told when to arrive — was Debra's, contributed by her to a
team formed at a hackathon in **October 2025**.

The team was given access to this repository. As §1 shows, they made **one**
commit between them, described above. The system was subsequently rebuilt from
first principles by Debra alone: a different architecture, a different data
model, a different product surface (a mobile app, a staff desktop application and
an API, in place of a single website), and a different commercial model
(multi-tenant, sector-aware, sold to organisations).

---

## 5 · Keeping this current

Re-verify after any significant period of work:

```bash
git log --all --format='%an <%ae>' | sort | uniq -c | sort -rn
git log --all --format='%B' | grep -i 'co-authored-by' | sort | uniq -c
```

If a new author ever appears, add them here with what they contributed and
whether it survives. A record that is maintained is evidence; one written once
and left is an assertion.
