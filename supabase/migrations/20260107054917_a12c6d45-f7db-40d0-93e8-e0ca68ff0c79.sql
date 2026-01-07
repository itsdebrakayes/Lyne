-- Remove foreign key constraint on user_id to allow staff without auth accounts
ALTER TABLE public.staff_roles DROP CONSTRAINT staff_roles_user_id_fkey;