-- Add branch_id to staff_roles table
ALTER TABLE public.staff_roles 
ADD COLUMN branch_id uuid REFERENCES public.branches(id);

-- Add branch_id to counters table  
ALTER TABLE public.counters
ADD COLUMN branch_id uuid REFERENCES public.branches(id);

-- Create index for better query performance
CREATE INDEX idx_staff_roles_branch ON public.staff_roles(branch_id);
CREATE INDEX idx_counters_branch ON public.counters(branch_id);

-- Update RLS policy for staff to see only their branch's data
CREATE OR REPLACE FUNCTION public.is_same_branch(_user_id uuid, _branch_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_roles
    WHERE user_id = _user_id 
      AND branch_id = _branch_id 
      AND is_active = true
  )
$$;