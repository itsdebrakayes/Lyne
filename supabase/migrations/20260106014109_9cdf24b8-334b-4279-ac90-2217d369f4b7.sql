-- Create function to shift queue positions when a customer is called
CREATE OR REPLACE FUNCTION public.shift_queue_positions(
  p_org_id uuid,
  p_service_id uuid,
  p_from_position integer
) RETURNS void AS $$
BEGIN
  UPDATE public.lines
  SET position = position - 1
  WHERE organization_id = p_org_id
    AND service_id = p_service_id
    AND status = 'waiting'
    AND position > p_from_position;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;