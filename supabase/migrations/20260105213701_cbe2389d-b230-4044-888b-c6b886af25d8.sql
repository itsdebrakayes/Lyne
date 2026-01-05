
-- =============================================
-- QmeNow Database Schema
-- =============================================

-- 1. Create the role enum for staff access levels
CREATE TYPE public.app_role AS ENUM ('staff', 'section_manager', 'manager', 'executive');

-- =============================================
-- TABLE 1: organizations
-- =============================================
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  logo_url text,
  primary_color text DEFAULT '#3B82F6',
  secondary_color text,
  description text,
  full_description text,
  address text,
  phone text,
  email text,
  website text,
  operating_hours jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Public can read active organizations (for directory)
CREATE POLICY "Anyone can view active organizations"
ON public.organizations FOR SELECT
USING (is_active = true);

-- =============================================
-- TABLE 2: services
-- =============================================
CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  icon text DEFAULT 'circle',
  color text DEFAULT '#3B82F6',
  base_avg_time_minutes integer DEFAULT 10,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Public can read active services
CREATE POLICY "Anyone can view active services"
ON public.services FOR SELECT
USING (is_active = true);

-- =============================================
-- TABLE 3: counters
-- =============================================
CREATE TABLE public.counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  service_id uuid REFERENCES public.services(id) ON DELETE CASCADE NOT NULL,
  counter_number integer NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.counters ENABLE ROW LEVEL SECURITY;

-- Public can read active counters
CREATE POLICY "Anyone can view active counters"
ON public.counters FOR SELECT
USING (is_active = true);

-- =============================================
-- TABLE 4: staff_roles (SECURE - created early for function references)
-- =============================================
CREATE TABLE public.staff_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  assigned_service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  assigned_section text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, organization_id)
);

ALTER TABLE public.staff_roles ENABLE ROW LEVEL SECURITY;

-- =============================================
-- SECURE FUNCTIONS (must be created after staff_roles)
-- =============================================

-- Check if user has specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_roles
    WHERE user_id = _user_id 
      AND role = _role 
      AND is_active = true
  )
$$;

-- Get user role for specific organization
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid, _org_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.staff_roles
  WHERE user_id = _user_id 
    AND organization_id = _org_id 
    AND is_active = true
  LIMIT 1
$$;

-- Check if user has any staff role in an organization
CREATE OR REPLACE FUNCTION public.is_org_staff(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_roles
    WHERE user_id = _user_id 
      AND organization_id = _org_id 
      AND is_active = true
  )
$$;

-- Check if user is manager or higher
CREATE OR REPLACE FUNCTION public.is_manager_or_higher(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_roles
    WHERE user_id = _user_id 
      AND organization_id = _org_id 
      AND role IN ('manager', 'executive')
      AND is_active = true
  )
$$;

-- Check if user is executive
CREATE OR REPLACE FUNCTION public.is_executive(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_roles
    WHERE user_id = _user_id 
      AND organization_id = _org_id 
      AND role = 'executive'
      AND is_active = true
  )
$$;

-- =============================================
-- RLS POLICIES FOR staff_roles
-- =============================================

-- Users can view their own roles
CREATE POLICY "Users can view their own roles"
ON public.staff_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Executives can view all roles in their org
CREATE POLICY "Executives can view org roles"
ON public.staff_roles FOR SELECT
TO authenticated
USING (public.is_executive(auth.uid(), organization_id));

-- Executives can manage roles
CREATE POLICY "Executives can insert roles"
ON public.staff_roles FOR INSERT
TO authenticated
WITH CHECK (public.is_executive(auth.uid(), organization_id));

CREATE POLICY "Executives can update roles"
ON public.staff_roles FOR UPDATE
TO authenticated
USING (public.is_executive(auth.uid(), organization_id));

CREATE POLICY "Executives can delete roles"
ON public.staff_roles FOR DELETE
TO authenticated
USING (public.is_executive(auth.uid(), organization_id));

-- =============================================
-- TABLE 5: counter_assignments
-- =============================================
CREATE TABLE public.counter_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  counter_id uuid REFERENCES public.counters(id) ON DELETE CASCADE NOT NULL,
  staff_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  assignment_date date NOT NULL,
  shift_start time,
  shift_end time,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.counter_assignments ENABLE ROW LEVEL SECURITY;

-- Staff can view their own assignments
CREATE POLICY "Staff can view own assignments"
ON public.counter_assignments FOR SELECT
TO authenticated
USING (staff_user_id = auth.uid());

-- Managers can view all assignments in their org
CREATE POLICY "Managers can view org assignments"
ON public.counter_assignments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.counters c
    WHERE c.id = counter_id
    AND public.is_manager_or_higher(auth.uid(), c.organization_id)
  )
);

-- Managers can manage assignments
CREATE POLICY "Managers can insert assignments"
ON public.counter_assignments FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.counters c
    WHERE c.id = counter_id
    AND public.is_manager_or_higher(auth.uid(), c.organization_id)
  )
);

-- =============================================
-- TABLE 6: clients
-- =============================================
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  client_type text DEFAULT 'viewer' CHECK (client_type IN ('viewer', 'participant')),
  full_name text,
  phone text,
  email text,
  id_number text,
  date_of_birth date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Users can view their own client record
CREATE POLICY "Users can view own client record"
ON public.clients FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can update their own client record
CREATE POLICY "Users can update own client record"
ON public.clients FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Anyone can insert (for anonymous viewers)
CREATE POLICY "Anyone can create client record"
ON public.clients FOR INSERT
WITH CHECK (true);

-- =============================================
-- TABLE 7: visitor_sessions
-- =============================================
CREATE TABLE public.visitor_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  session_start timestamptz DEFAULT now(),
  session_end timestamptz,
  duration_seconds integer,
  services_viewed jsonb DEFAULT '[]',
  queue_state_snapshot jsonb,
  did_join boolean DEFAULT false,
  device_info text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.visitor_sessions ENABLE ROW LEVEL SECURITY;

-- Anyone can insert visitor sessions
CREATE POLICY "Anyone can create visitor session"
ON public.visitor_sessions FOR INSERT
WITH CHECK (true);

-- Executives can view visitor sessions for analytics
CREATE POLICY "Executives can view visitor sessions"
ON public.visitor_sessions FOR SELECT
TO authenticated
USING (public.is_executive(auth.uid(), organization_id));

-- =============================================
-- TABLE 8: lines (queue entries)
-- =============================================
CREATE TABLE public.lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  service_id uuid REFERENCES public.services(id) ON DELETE CASCADE NOT NULL,
  ticket_number text NOT NULL,
  position integer NOT NULL,
  status text DEFAULT 'waiting' CHECK (status IN ('waiting', 'serving', 'completed', 'cancelled', 'no_show')),
  estimated_wait_minutes integer,
  actual_wait_minutes integer,
  notes text,
  joined_at timestamptz DEFAULT now(),
  called_at timestamptz,
  started_serving_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.lines ENABLE ROW LEVEL SECURITY;

-- Anyone can view waiting lines (for public display)
CREATE POLICY "Anyone can view waiting lines"
ON public.lines FOR SELECT
USING (status IN ('waiting', 'serving'));

-- Authenticated users can view their own lines
CREATE POLICY "Users can view own lines"
ON public.lines FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_id AND c.user_id = auth.uid()
  )
);

-- Anyone can insert into lines (joining queue)
CREATE POLICY "Anyone can join queue"
ON public.lines FOR INSERT
WITH CHECK (true);

-- Users can cancel their own line entry
CREATE POLICY "Users can cancel own line"
ON public.lines FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_id AND c.user_id = auth.uid()
  )
);

-- Staff can update lines in their service
CREATE POLICY "Staff can update service lines"
ON public.lines FOR UPDATE
TO authenticated
USING (public.is_org_staff(auth.uid(), organization_id));

-- Enable realtime for lines
ALTER PUBLICATION supabase_realtime ADD TABLE public.lines;

-- =============================================
-- TABLE 9: service_sessions
-- =============================================
CREATE TABLE public.service_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id uuid REFERENCES public.lines(id) ON DELETE CASCADE NOT NULL,
  counter_id uuid REFERENCES public.counters(id) ON DELETE SET NULL,
  staff_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  duration_minutes integer,
  outcome text DEFAULT 'completed' CHECK (outcome IN ('completed', 'referred', 'cancelled')),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.service_sessions ENABLE ROW LEVEL SECURITY;

-- Staff can view sessions they handled
CREATE POLICY "Staff can view own sessions"
ON public.service_sessions FOR SELECT
TO authenticated
USING (staff_user_id = auth.uid());

-- Managers can view all sessions in their org
CREATE POLICY "Managers can view org sessions"
ON public.service_sessions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.lines l
    WHERE l.id = line_id
    AND public.is_manager_or_higher(auth.uid(), l.organization_id)
  )
);

-- Staff can insert sessions
CREATE POLICY "Staff can insert sessions"
ON public.service_sessions FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.lines l
    WHERE l.id = line_id
    AND public.is_org_staff(auth.uid(), l.organization_id)
  )
);

-- Staff can update their own sessions
CREATE POLICY "Staff can update own sessions"
ON public.service_sessions FOR UPDATE
TO authenticated
USING (staff_user_id = auth.uid());

-- =============================================
-- TABLE 10: visit_history (analytics)
-- =============================================
CREATE TABLE public.visit_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  visit_date date NOT NULL,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  hour_of_day integer NOT NULL CHECK (hour_of_day >= 0 AND hour_of_day <= 23),
  wait_time_minutes integer,
  service_time_minutes integer,
  was_no_show boolean DEFAULT false,
  was_cancelled boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.visit_history ENABLE ROW LEVEL SECURITY;

-- Only executives can view visit history
CREATE POLICY "Executives can view visit history"
ON public.visit_history FOR SELECT
TO authenticated
USING (public.is_executive(auth.uid(), organization_id));

-- System can insert visit history (via trigger or function)
CREATE POLICY "System can insert visit history"
ON public.visit_history FOR INSERT
WITH CHECK (true);

-- =============================================
-- ADDITIONAL RLS POLICIES FOR MANAGERS
-- =============================================

-- Managers can update organizations they manage
CREATE POLICY "Managers can update their organization"
ON public.organizations FOR UPDATE
TO authenticated
USING (public.is_manager_or_higher(auth.uid(), id));

-- Managers can manage services
CREATE POLICY "Managers can insert services"
ON public.services FOR INSERT
TO authenticated
WITH CHECK (public.is_manager_or_higher(auth.uid(), organization_id));

CREATE POLICY "Managers can update services"
ON public.services FOR UPDATE
TO authenticated
USING (public.is_manager_or_higher(auth.uid(), organization_id));

CREATE POLICY "Managers can delete services"
ON public.services FOR DELETE
TO authenticated
USING (public.is_manager_or_higher(auth.uid(), organization_id));

-- Managers can manage counters
CREATE POLICY "Managers can insert counters"
ON public.counters FOR INSERT
TO authenticated
WITH CHECK (public.is_manager_or_higher(auth.uid(), organization_id));

CREATE POLICY "Managers can update counters"
ON public.counters FOR UPDATE
TO authenticated
USING (public.is_manager_or_higher(auth.uid(), organization_id));

-- Managers can view all clients in their org (via lines)
CREATE POLICY "Managers can view org clients"
ON public.clients FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.lines l
    JOIN public.organizations o ON l.organization_id = o.id
    WHERE l.client_id = public.clients.id
    AND public.is_manager_or_higher(auth.uid(), o.id)
  )
);

-- =============================================
-- TRIGGER: Update updated_at timestamp
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- SEED DATA: Organizations
-- =============================================
INSERT INTO public.organizations (name, slug, logo_url, primary_color, secondary_color, description, full_description, address, phone, email, is_active) VALUES
(
  'Tax Administration Jamaica',
  'taj',
  NULL,
  '#1E3A8A',
  '#3B82F6',
  'Jamaica''s tax collection and administration agency',
  'Tax Administration Jamaica (TAJ) is responsible for collecting taxes and administering tax laws in Jamaica. Services include TRN registration, tax payments, property titles, and motor vehicle licensing.',
  '12 Ocean Boulevard, Kingston, Jamaica',
  '1-888-TAX-HELP',
  'info@taj.gov.jm',
  true
),
(
  'National Housing Trust',
  'nht',
  NULL,
  '#059669',
  '#10B981',
  'Jamaica''s national housing development organization',
  'The National Housing Trust (NHT) provides affordable housing solutions for Jamaican workers through contributions and mortgage financing. Services include contribution payments, mortgage applications, and refund processing.',
  '4 Park Boulevard, Kingston 5, Jamaica',
  '1-888-CALL-NHT',
  'info@nht.gov.jm',
  true
),
(
  'Passport, Immigration & Citizenship Agency',
  'pica',
  NULL,
  '#7C3AED',
  '#8B5CF6',
  'Jamaica''s passport and immigration services',
  'PICA handles all passport applications, renewals, and immigration matters for Jamaican citizens. Services include new passport applications, renewals, name changes, and emergency travel documents.',
  '25C Constant Spring Road, Kingston 10, Jamaica',
  '1-888-GET-PICA',
  'info@pica.gov.jm',
  true
);

-- =============================================
-- SEED DATA: Services
-- =============================================

-- TAJ Services
INSERT INTO public.services (organization_id, name, icon, color, base_avg_time_minutes, display_order) 
SELECT id, 'Cashier', 'banknote', '#22C55E', 8, 1 FROM public.organizations WHERE slug = 'taj'
UNION ALL
SELECT id, 'Property Titles', 'file-text', '#3B82F6', 15, 2 FROM public.organizations WHERE slug = 'taj'
UNION ALL
SELECT id, 'TRN Services', 'id-card', '#F59E0B', 12, 3 FROM public.organizations WHERE slug = 'taj'
UNION ALL
SELECT id, 'Motor Vehicle', 'car', '#EF4444', 10, 4 FROM public.organizations WHERE slug = 'taj'
UNION ALL
SELECT id, 'Customer Service', 'headphones', '#8B5CF6', 10, 5 FROM public.organizations WHERE slug = 'taj'
UNION ALL
SELECT id, 'Compliance', 'shield-check', '#06B6D4', 20, 6 FROM public.organizations WHERE slug = 'taj';

-- NHT Services
INSERT INTO public.services (organization_id, name, icon, color, base_avg_time_minutes, display_order)
SELECT id, 'Contributions', 'wallet', '#22C55E', 10, 1 FROM public.organizations WHERE slug = 'nht'
UNION ALL
SELECT id, 'Mortgage Applications', 'home', '#3B82F6', 25, 2 FROM public.organizations WHERE slug = 'nht'
UNION ALL
SELECT id, 'Refund Processing', 'rotate-ccw', '#F59E0B', 15, 3 FROM public.organizations WHERE slug = 'nht'
UNION ALL
SELECT id, 'General Inquiries', 'help-circle', '#8B5CF6', 8, 4 FROM public.organizations WHERE slug = 'nht';

-- PICA Services
INSERT INTO public.services (organization_id, name, icon, color, base_avg_time_minutes, display_order)
SELECT id, 'New Applications', 'file-plus', '#3B82F6', 20, 1 FROM public.organizations WHERE slug = 'pica'
UNION ALL
SELECT id, 'Renewals', 'refresh-cw', '#22C55E', 15, 2 FROM public.organizations WHERE slug = 'pica'
UNION ALL
SELECT id, 'Collections', 'package', '#F59E0B', 5, 3 FROM public.organizations WHERE slug = 'pica'
UNION ALL
SELECT id, 'Corrections', 'edit', '#EF4444', 12, 4 FROM public.organizations WHERE slug = 'pica'
UNION ALL
SELECT id, 'Emergency Travel', 'plane', '#7C3AED', 30, 5 FROM public.organizations WHERE slug = 'pica';

-- =============================================
-- SEED DATA: Counters (3-5 per service)
-- =============================================
INSERT INTO public.counters (organization_id, service_id, counter_number)
SELECT s.organization_id, s.id, generate_series(1, 
  CASE 
    WHEN s.name IN ('Cashier', 'Contributions', 'Collections') THEN 5
    WHEN s.name IN ('Customer Service', 'General Inquiries') THEN 4
    ELSE 3
  END
)
FROM public.services s;

-- =============================================
-- SEED DATA: Sample clients (viewers and participants)
-- =============================================
INSERT INTO public.clients (client_type, full_name, phone, email) VALUES
('participant', 'Marcus Johnson', '876-555-0101', 'marcus.j@email.com'),
('participant', 'Shelly-Ann Williams', '876-555-0102', 'shelly.w@email.com'),
('participant', 'Devon Brown', '876-555-0103', 'devon.b@email.com'),
('participant', 'Keisha Campbell', '876-555-0104', 'keisha.c@email.com'),
('participant', 'Andre Thompson', '876-555-0105', 'andre.t@email.com'),
('participant', 'Tanya Morrison', '876-555-0106', 'tanya.m@email.com'),
('participant', 'Ricardo Smith', '876-555-0107', 'ricardo.s@email.com'),
('participant', 'Natalie Grant', '876-555-0108', 'natalie.g@email.com'),
('viewer', NULL, NULL, NULL),
('viewer', NULL, NULL, NULL),
('viewer', NULL, NULL, NULL);

-- =============================================
-- SEED DATA: Sample lines (queue entries)
-- =============================================
INSERT INTO public.lines (organization_id, client_id, service_id, ticket_number, position, status, estimated_wait_minutes)
SELECT 
  o.id,
  c.id,
  s.id,
  CONCAT(UPPER(LEFT(s.name, 4)), '-', LPAD((ROW_NUMBER() OVER (PARTITION BY s.id ORDER BY c.id))::text, 3, '0')),
  ROW_NUMBER() OVER (PARTITION BY s.id ORDER BY c.id),
  'waiting',
  s.base_avg_time_minutes * ROW_NUMBER() OVER (PARTITION BY s.id ORDER BY c.id)
FROM public.organizations o
CROSS JOIN (SELECT id FROM public.clients WHERE client_type = 'participant' LIMIT 8) c
JOIN public.services s ON s.organization_id = o.id
WHERE o.slug = 'taj'
AND s.name IN ('Cashier', 'TRN Services')
LIMIT 12;
