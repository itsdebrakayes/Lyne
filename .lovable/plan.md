

# Fix Database Connection to External Supabase

## Problem Analysis

Your external Supabase database (vdyyxxjkragvauevjocy) IS connected correctly, but there's a **schema mismatch**. The network logs show:

- Organizations: Loads successfully (200)
- Branches: Fails with `column branches.is_open does not exist`

This means your external database has different column names than what the code expects.

## Solution Overview

Update all hooks to match your external database schema by removing/adjusting filters for columns that don't exist.

---

## Phase 1: Fix Branch Hook

**File: `src/hooks/useBranches.ts`**

Remove the `.eq('is_open', true)` filter since your external DB doesn't have this column. Branches will be fetched without the open/closed filter.

---

## Phase 2: Fix Organization Hook  

**File: `src/hooks/useOrganizations.ts`**

Ensure the organization hook handles the case where `is_active` might not exist, or adjust the query if needed.

---

## Phase 3: Verify Services & Queue Hooks

**Files:**
- `src/hooks/useServices.ts` - Check `is_active` filter works
- `src/hooks/useQueueData.ts` - Already looks correct

---

## Phase 4: Update FlipCard Component

**File: `src/components/FlipCard.tsx`**

The FlipCard uses `organization.slug` to navigate. Network logs show your external DB returns organizations with `slug` field, so this should work once branches are fixed.

---

## Phase 5: Logo Mapping

The logo assets already exist in `/src/assets/logos/`:
- `pica-logo.png`
- `nht-logo.png`  
- `taj-logo.png`

The FlipCard already has a `logoMap` that maps slugs to these images:
```typescript
const logoMap: Record<string, string> = {
  'pica': picaLogo,
  'nht': nhtLogo,
  'taj': tajLogo,
};
```

This will work once the data flows correctly.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useBranches.ts` | Remove `.eq('is_open', true)` filter |
| `src/hooks/useBranches.ts` | Update `Branch` interface to make `is_open` optional |
| `src/hooks/useOrganizations.ts` | Verify `is_active` filter works with your schema |

---

## Technical Implementation

### useBranches.ts Changes

```typescript
// BEFORE
.eq('organization_id', organizationId)
.eq('is_open', true)  // Remove this line
.order('is_main_branch', { ascending: false });

// AFTER  
.eq('organization_id', organizationId)
.order('is_main_branch', { ascending: false });
```

### Branch Interface Update

Make `is_open` optional since it may not exist in your external DB:

```typescript
export interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  photo_url: string | null;
  organization_id: string;
  is_main_branch: boolean | null;
  is_open?: boolean | null;  // Make optional
  opening_time: string | null;
  closing_time: string | null;
  friday_closing_time: string | null;
  created_at: string | null;
}
```

---

## Expected Outcome

After these changes:
1. Organizations will display with logos (TAJ, NHT, PICA)
2. Clicking an organization will load its branches
3. Branch selection will show services
4. Queue data will display for selected branch/service

