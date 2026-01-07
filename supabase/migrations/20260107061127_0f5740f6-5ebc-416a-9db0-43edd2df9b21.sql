-- Drop the queue limit trigger
DROP TRIGGER IF EXISTS trigger_check_queue_limit ON public.lines;

-- Drop the check_queue_limit function
DROP FUNCTION IF EXISTS public.check_queue_limit();

-- Fix orphaned entries - assign branch_id based on organization
UPDATE public.lines l
SET branch_id = (
  SELECT b.id FROM public.branches b 
  WHERE b.organization_id = l.organization_id 
  AND b.is_main_branch = true
  LIMIT 1
)
WHERE l.branch_id IS NULL;