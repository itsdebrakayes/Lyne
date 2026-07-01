-- QMe Now tenant-scoped Supabase RLS hardening.
-- Keeps service-role writes available for edge jobs while preventing
-- manager/executive reads from crossing organization boundaries.

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS organization_id uuid NULL REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created
  ON public.audit_logs (organization_id, created_at DESC);

DROP POLICY IF EXISTS "Managers can read audit logs" ON public.audit_logs;
CREATE POLICY "Managers can read audit logs"
  ON public.audit_logs
  FOR SELECT
  USING (
    organization_id IS NOT NULL
    AND public.is_manager_or_higher(auth.uid(), organization_id)
  );

DROP POLICY IF EXISTS "Managers can view org invites" ON public.staff_invites;
CREATE POLICY "Managers can view org invites"
  ON public.staff_invites
  FOR SELECT
  USING (
    public.is_manager_or_higher(auth.uid(), organization_id)
    OR (status = 'pending' AND expires_at > now())
  );

DROP POLICY IF EXISTS "Managers can create invites" ON public.staff_invites;
CREATE POLICY "Managers can create invites"
  ON public.staff_invites
  FOR INSERT
  WITH CHECK (
    public.is_manager_or_higher(auth.uid(), organization_id)
  );

DROP POLICY IF EXISTS "Managers can revoke invites" ON public.staff_invites;
CREATE POLICY "Managers can revoke invites"
  ON public.staff_invites
  FOR UPDATE
  USING (
    public.is_manager_or_higher(auth.uid(), organization_id)
  )
  WITH CHECK (
    public.is_manager_or_higher(auth.uid(), organization_id)
  );

DROP POLICY IF EXISTS "Managers can view org insights" ON public.analytics_insights;
CREATE POLICY "Managers can view org insights"
  ON public.analytics_insights
  FOR SELECT
  USING (public.is_manager_or_higher(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Managers can view org performance" ON public.staff_performance;
CREATE POLICY "Managers can view org performance"
  ON public.staff_performance
  FOR SELECT
  USING (public.is_manager_or_higher(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Managers can view export logs" ON public.export_logs;
CREATE POLICY "Managers can view export logs"
  ON public.export_logs
  FOR SELECT
  USING (public.is_manager_or_higher(auth.uid(), organization_id));
