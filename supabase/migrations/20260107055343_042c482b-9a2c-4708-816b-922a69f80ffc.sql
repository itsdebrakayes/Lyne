-- Add new profile columns to staff_roles
ALTER TABLE public.staff_roles
ADD COLUMN IF NOT EXISTS date_of_birth date,
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS staff_id text UNIQUE,
ADD COLUMN IF NOT EXISTS counter_id uuid REFERENCES public.counters(id);

-- Create a unique constraint for staff_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_roles_staff_id ON public.staff_roles(staff_id) WHERE staff_id IS NOT NULL;

-- Create index for counter_id
CREATE INDEX IF NOT EXISTS idx_staff_roles_counter_id ON public.staff_roles(counter_id);

-- Create a function to generate staff_id (org prefix + sequential number)
CREATE OR REPLACE FUNCTION public.generate_staff_id()
RETURNS TRIGGER AS $$
DECLARE
  org_slug text;
  next_num integer;
  new_staff_id text;
BEGIN
  -- Get the organization slug
  SELECT slug INTO org_slug FROM public.organizations WHERE id = NEW.organization_id;
  
  -- Get the next sequential number for this organization
  SELECT COALESCE(MAX(
    CASE 
      WHEN staff_id ~ ('^' || UPPER(org_slug) || '-[0-9]+$')
      THEN CAST(SUBSTRING(staff_id FROM '[0-9]+$') AS integer)
      ELSE 0
    END
  ), 0) + 1 
  INTO next_num 
  FROM public.staff_roles 
  WHERE organization_id = NEW.organization_id;
  
  -- Generate the staff_id
  new_staff_id := UPPER(org_slug) || '-' || LPAD(next_num::text, 4, '0');
  
  NEW.staff_id := new_staff_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger to auto-generate staff_id on insert
DROP TRIGGER IF EXISTS trigger_generate_staff_id ON public.staff_roles;
CREATE TRIGGER trigger_generate_staff_id
  BEFORE INSERT ON public.staff_roles
  FOR EACH ROW
  WHEN (NEW.staff_id IS NULL)
  EXECUTE FUNCTION public.generate_staff_id();

-- Populate staff_id for existing records without one
DO $$
DECLARE
  r RECORD;
  org_slug text;
  counter integer;
  new_staff_id text;
BEGIN
  FOR r IN 
    SELECT sr.id, sr.organization_id 
    FROM public.staff_roles sr 
    WHERE sr.staff_id IS NULL
    ORDER BY sr.created_at
  LOOP
    SELECT slug INTO org_slug FROM public.organizations WHERE id = r.organization_id;
    
    SELECT COALESCE(MAX(
      CASE 
        WHEN staff_id ~ ('^' || UPPER(org_slug) || '-[0-9]+$')
        THEN CAST(SUBSTRING(staff_id FROM '[0-9]+$') AS integer)
        ELSE 0
      END
    ), 0) + 1 
    INTO counter 
    FROM public.staff_roles 
    WHERE organization_id = r.organization_id;
    
    new_staff_id := UPPER(org_slug) || '-' || LPAD(counter::text, 4, '0');
    
    UPDATE public.staff_roles SET staff_id = new_staff_id WHERE id = r.id;
  END LOOP;
END $$;