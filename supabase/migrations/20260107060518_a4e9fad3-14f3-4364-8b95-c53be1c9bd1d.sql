-- Add branch_id to visit_history for complete tracking
ALTER TABLE public.visit_history
ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id);

-- Create index for branch lookups in visit_history
CREATE INDEX IF NOT EXISTS idx_visit_history_branch ON public.visit_history(branch_id);

-- Create a function to enforce queue limits (10-50 per service per branch)
CREATE OR REPLACE FUNCTION public.check_queue_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count integer;
  max_queue_size integer := 50; -- Maximum queue size per service per branch
BEGIN
  -- Only check for new 'waiting' entries
  IF NEW.status = 'waiting' THEN
    SELECT COUNT(*) INTO current_count
    FROM public.lines
    WHERE organization_id = NEW.organization_id
      AND service_id = NEW.service_id
      AND branch_id = NEW.branch_id
      AND status = 'waiting'
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    
    IF current_count >= max_queue_size THEN
      RAISE EXCEPTION 'Queue limit reached: Maximum % customers allowed per service per branch', max_queue_size;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger to enforce queue limit on insert
DROP TRIGGER IF EXISTS trigger_check_queue_limit ON public.lines;
CREATE TRIGGER trigger_check_queue_limit
  BEFORE INSERT ON public.lines
  FOR EACH ROW
  EXECUTE FUNCTION public.check_queue_limit();

-- Create a function to get queue count for a service at a branch
CREATE OR REPLACE FUNCTION public.get_queue_count(
  p_organization_id uuid,
  p_service_id uuid,
  p_branch_id uuid
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.lines
  WHERE organization_id = p_organization_id
    AND service_id = p_service_id
    AND branch_id = p_branch_id
    AND status = 'waiting'
$$;

-- Create a function to check if queue is available
CREATE OR REPLACE FUNCTION public.is_queue_available(
  p_organization_id uuid,
  p_service_id uuid,
  p_branch_id uuid,
  p_max_size integer DEFAULT 50
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT get_queue_count(p_organization_id, p_service_id, p_branch_id) < p_max_size
$$;