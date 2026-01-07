-- Add profile columns to staff_roles to store staff info without needing auth.users
ALTER TABLE public.staff_roles 
ADD COLUMN full_name text,
ADD COLUMN email text;

-- Add index for email lookups
CREATE INDEX idx_staff_roles_email ON public.staff_roles(email);