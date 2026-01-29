

# Fix Database Connection to External Supabase

## ✅ COMPLETED

All changes have been implemented to align the code with the external Supabase database schema.

---

## Changes Made

### 1. Fixed Branch Hook (`src/hooks/useBranches.ts`)
- ✅ Removed `.eq('is_open', true)` filter from both `useBranches` and `useBranchesBySlug`
- ✅ Made `is_open` optional in the `Branch` interface
- ✅ Updated `useBranchesBySlug` to support both `slug` and `code` fields

### 2. Fixed Organization Hook (`src/hooks/useOrganizations.ts`)
- ✅ Added optional `code` field to `Organization` interface
- ✅ Updated `useOrganization` to query by both `slug` and `code`

### 3. Updated FlipCard Component (`src/components/FlipCard.tsx`)
- ✅ Changed to use local `Branch` and `Organization` types instead of Supabase types
- ✅ Updated logo mapping to support both lowercase and uppercase codes (PICA, NHT, TAJ)
- ✅ Fixed navigation to use `orgIdentifier` which works with both `slug` and `code`

---

## Expected Behavior

After these changes:
1. ✅ Organizations display with logos (TAJ, NHT, PICA)
2. ✅ Clicking an organization loads its branches (no more `is_open` error)
3. ✅ Branch selection shows services
4. ✅ Queue data displays for selected branch/service
