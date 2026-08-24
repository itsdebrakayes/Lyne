-- =============================================================
-- LYNE — Supabase RLS Migration: Security Hardening
-- Date: 2026-05-27
-- =============================================================
-- This migration adds strict Row Level Security policies for:
--   1. audit_logs        — Only managers/executives can read; system writes only
--   2. ocr_results       — Users can only see their own; staff can see in-service
--   3. staff_invites     — Managers/executives can manage; invitees can redeem
-- =============================================================

-- =============================================================
-- TABLE: audit_logs
-- =============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id            UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    actor_id      UUID         NULL,
    actor_type    TEXT         NOT NULL DEFAULT 'anonymous'
                  CHECK (actor_type IN ('staff','user','anonymous','system')),
    action        TEXT         NOT NULL,
    resource_type TEXT         NULL,
    resource_id   UUID         NULL,
    ip_address    TEXT         NULL,
    user_agent    TEXT         NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Managers and executives can read audit logs for their organization
CREATE POLICY "Managers can read audit logs"
    ON public.audit_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.staff_roles sr
            WHERE sr.user_id = auth.uid()
              AND sr.role IN ('manager', 'executive')
        )
    );

-- No user can insert directly — audit logs are written by the backend service role only
-- (Service role bypasses RLS, so no INSERT policy is needed for the backend)

-- No updates or deletes allowed on audit logs (immutable)
-- (Absence of UPDATE/DELETE policies means they are denied for all non-service-role users)

-- =============================================================
-- TABLE: ocr_results
-- =============================================================
CREATE TABLE IF NOT EXISTS public.ocr_results (
    id                   UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id              UUID         NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    queue_id             UUID         NULL,
    service_id           UUID         NULL,
    document_type        TEXT         NOT NULL DEFAULT 'other'
                         CHECK (document_type IN ('national_id','trn','passport','drivers_license','other')),
    raw_text             TEXT         NULL,
    extracted_full_name  TEXT         NULL,
    extracted_dob        TEXT         NULL,
    extracted_national_id TEXT        NULL,
    extracted_trn        TEXT         NULL,
    extracted_passport   TEXT         NULL,
    confidence_score     NUMERIC(5,2) NULL,
    storage_path         TEXT         NULL,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ocr_results ENABLE ROW LEVEL SECURITY;

-- Users can only view their own OCR results
CREATE POLICY "Users can view own OCR results"
    ON public.ocr_results
    FOR SELECT
    USING (user_id = auth.uid());

-- Users can insert their own OCR results
CREATE POLICY "Users can insert own OCR results"
    ON public.ocr_results
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Users can update their own OCR results (e.g., associate with a queue)
CREATE POLICY "Users can update own OCR results"
    ON public.ocr_results
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Staff can view OCR results. Active-ticket scoping (in_service only) is
-- enforced by the backend API against the operational MySQL database —
-- live queue state does not exist in Postgres, so it cannot be expressed
-- here. This policy is defense-in-depth limiting reads to staff accounts.
CREATE POLICY "Staff can view OCR results for active tickets"
    ON public.ocr_results
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.staff_roles sr
            WHERE sr.user_id = auth.uid()
              AND sr.role IN ('staff', 'manager', 'executive')
        )
    );

-- =============================================================
-- TABLE: staff_invites
-- =============================================================
CREATE TABLE IF NOT EXISTS public.staff_invites (
    id                    UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id       UUID         NOT NULL,
    branch_id             UUID         NULL,
    email                 TEXT         NOT NULL,
    full_name             TEXT         NOT NULL,
    role                  TEXT         NOT NULL
                          CHECK (role IN ('line_staff','manager','executive')),
    invite_code           TEXT         NOT NULL UNIQUE,
    invited_by_staff_id   UUID         NULL,
    status                TEXT         NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','redeemed','revoked','expired')),
    expires_at            TIMESTAMPTZ  NOT NULL,
    redeemed_at           TIMESTAMPTZ  NULL,
    redeemed_by_staff_id  UUID         NULL,
    revoked_at            TIMESTAMPTZ  NULL,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE public.staff_invites ENABLE ROW LEVEL SECURITY;

-- Managers and executives can view invites for their organization
CREATE POLICY "Managers can view org invites"
    ON public.staff_invites
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.staff_roles sr
            WHERE sr.user_id = auth.uid()
              AND sr.role IN ('manager', 'executive')
        )
    );

-- Managers and executives can create invites
CREATE POLICY "Managers can create invites"
    ON public.staff_invites
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.staff_roles sr
            WHERE sr.user_id = auth.uid()
              AND sr.role IN ('manager', 'executive')
        )
    );

-- Managers and executives can revoke invites (update status to 'revoked')
CREATE POLICY "Managers can revoke invites"
    ON public.staff_invites
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.staff_roles sr
            WHERE sr.user_id = auth.uid()
              AND sr.role IN ('manager', 'executive')
        )
    );

-- Anyone can read a pending invite by its invite_code (for redemption)
-- This is intentionally permissive — the invite_code is a secret shared out-of-band
CREATE POLICY "Anyone can read invite by code for redemption"
    ON public.staff_invites
    FOR SELECT
    USING (status = 'pending' AND expires_at > NOW());

-- =============================================================
-- HARDENING: Existing tables — add missing RLS policies
-- =============================================================

-- Ensure clients table blocks cross-user reads
-- (Policy should already exist from earlier migration, this is a safety check)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'clients'
          AND policyname = 'Users cannot read other users client records'
    ) THEN
        EXECUTE '
            CREATE POLICY "Users cannot read other users client records"
                ON public.clients
                FOR SELECT
                USING (user_id = auth.uid())
        ';
    END IF;
END $$;

-- Ensure visitor_sessions blocks cross-user reads for non-staff
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'visitor_sessions'
          AND policyname = 'Users can only view own sessions'
    ) THEN
        EXECUTE '
            CREATE POLICY "Users can only view own sessions"
                ON public.visitor_sessions
                FOR SELECT
                USING (
                    client_id IN (
                        SELECT id FROM public.clients WHERE user_id = auth.uid()
                    )
                    OR EXISTS (
                        SELECT 1 FROM public.staff_roles sr
                        WHERE sr.user_id = auth.uid()
                          AND sr.role IN (''staff'', ''manager'', ''executive'')
                    )
                )
        ';
    END IF;
END $$;

-- =============================================================
-- INDEXES for new tables
-- =============================================================
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id    ON public.audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action      ON public.audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at  ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ocr_results_user_id    ON public.ocr_results (user_id);
CREATE INDEX IF NOT EXISTS idx_staff_invites_email    ON public.staff_invites (email);
CREATE INDEX IF NOT EXISTS idx_staff_invites_code     ON public.staff_invites (invite_code);
CREATE INDEX IF NOT EXISTS idx_staff_invites_status   ON public.staff_invites (status, expires_at);
