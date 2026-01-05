-- Create branches table
CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT,
  opening_time TIME DEFAULT '08:00',
  closing_time TIME DEFAULT '17:00',
  friday_closing_time TIME DEFAULT '15:00',
  is_open BOOLEAN DEFAULT true,
  is_main_branch BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- Anyone can view open branches
CREATE POLICY "Anyone can view open branches"
ON public.branches
FOR SELECT
USING (is_open = true);

-- Managers can manage branches
CREATE POLICY "Managers can insert branches"
ON public.branches
FOR INSERT
WITH CHECK (is_manager_or_higher(auth.uid(), organization_id));

CREATE POLICY "Managers can update branches"
ON public.branches
FOR UPDATE
USING (is_manager_or_higher(auth.uid(), organization_id));

CREATE POLICY "Managers can delete branches"
ON public.branches
FOR DELETE
USING (is_manager_or_higher(auth.uid(), organization_id));

-- Insert TAJ branches (7 locations)
INSERT INTO public.branches (organization_id, name, address, phone, is_main_branch)
SELECT id, 'Crossroads', '2 Oxford Road, Kingston 5', '(876) 922-8100', true
FROM public.organizations WHERE slug = 'taj';

INSERT INTO public.branches (organization_id, name, address, phone)
SELECT id, 'Half Way Tree', '18 Ruthven Road, Kingston 10', '(876) 960-1234'
FROM public.organizations WHERE slug = 'taj';

INSERT INTO public.branches (organization_id, name, address, phone)
SELECT id, 'Spanish Town', '21 Adelaide Street, Spanish Town', '(876) 984-5678'
FROM public.organizations WHERE slug = 'taj';

INSERT INTO public.branches (organization_id, name, address, phone)
SELECT id, 'Constant Spring', '127 Constant Spring Road, Kingston 8', '(876) 924-9876'
FROM public.organizations WHERE slug = 'taj';

INSERT INTO public.branches (organization_id, name, address, phone)
SELECT id, 'Downtown', '12 Ocean Boulevard, Kingston', '(876) 922-5432'
FROM public.organizations WHERE slug = 'taj';

INSERT INTO public.branches (organization_id, name, address, phone)
SELECT id, 'Portmore', '3 Cookson Pen Road, Portmore', '(876) 988-7654'
FROM public.organizations WHERE slug = 'taj';

INSERT INTO public.branches (organization_id, name, address, phone)
SELECT id, 'Mandeville', '45 Manchester Road, Mandeville', '(876) 962-3456'
FROM public.organizations WHERE slug = 'taj';

-- Insert NHT branches (3 locations)
INSERT INTO public.branches (organization_id, name, address, phone, is_main_branch)
SELECT id, 'New Kingston HQ', '4 Park Boulevard, New Kingston', '(876) 929-6500', true
FROM public.organizations WHERE slug = 'nht';

INSERT INTO public.branches (organization_id, name, address, phone)
SELECT id, 'Spanish Town', '15 Burke Road, Spanish Town, St. Catherine', '(876) 984-2345'
FROM public.organizations WHERE slug = 'nht';

INSERT INTO public.branches (organization_id, name, address, phone)
SELECT id, 'Montego Bay', '23 Church Street, Montego Bay, St. James', '(876) 952-6789'
FROM public.organizations WHERE slug = 'nht';

-- Insert PICA branch (1 location)
INSERT INTO public.branches (organization_id, name, address, phone, is_main_branch)
SELECT id, 'Constant Spring', '25A Constant Spring Road, Kingston 10', '(876) 754-5261', true
FROM public.organizations WHERE slug = 'pica';