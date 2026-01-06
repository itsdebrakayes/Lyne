-- Fix RLS policies for queue operations

-- Drop existing problematic policies on lines table
DROP POLICY IF EXISTS "Staff can update service lines" ON public.lines;
DROP POLICY IF EXISTS "Staff can update lines in their org" ON public.lines;

-- Create proper UPDATE policy for staff
CREATE POLICY "Staff can update lines in their org"
  ON public.lines FOR UPDATE
  USING (
    public.is_org_staff(auth.uid(), organization_id)
  );

-- Enable RLS on service_sessions if not already
ALTER TABLE public.service_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies on service_sessions
DROP POLICY IF EXISTS "Staff can create sessions for their org" ON public.service_sessions;
DROP POLICY IF EXISTS "Staff can view sessions in their org" ON public.service_sessions;
DROP POLICY IF EXISTS "Staff can update sessions in their org" ON public.service_sessions;

-- Create INSERT policy for service_sessions
CREATE POLICY "Staff can create sessions for their org"
  ON public.service_sessions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lines l
      JOIN public.staff_roles sr ON sr.organization_id = l.organization_id
      WHERE l.id = line_id
      AND sr.user_id = auth.uid()
      AND sr.is_active = true
    )
  );

-- Create SELECT policy for service_sessions
CREATE POLICY "Staff can view sessions in their org"
  ON public.service_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.lines l
      JOIN public.staff_roles sr ON sr.organization_id = l.organization_id
      WHERE l.id = line_id
      AND sr.user_id = auth.uid()
      AND sr.is_active = true
    )
  );

-- Create UPDATE policy for service_sessions
CREATE POLICY "Staff can update sessions in their org"
  ON public.service_sessions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.lines l
      JOIN public.staff_roles sr ON sr.organization_id = l.organization_id
      WHERE l.id = line_id
      AND sr.user_id = auth.uid()
      AND sr.is_active = true
    )
  );