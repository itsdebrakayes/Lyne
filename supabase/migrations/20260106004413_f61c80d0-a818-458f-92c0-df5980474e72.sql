-- Create analytics_insights table for storing notebook JSON outputs
CREATE TABLE public.analytics_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  insight_type text NOT NULL,
  data jsonb NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  generated_at timestamptz DEFAULT now(),
  notebook_version text,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_insights_org_type ON public.analytics_insights(organization_id, insight_type);
CREATE INDEX idx_insights_generated ON public.analytics_insights(generated_at DESC);
CREATE INDEX idx_insights_type ON public.analytics_insights(insight_type);

-- Enable RLS
ALTER TABLE public.analytics_insights ENABLE ROW LEVEL SECURITY;

-- Managers and above can view insights
CREATE POLICY "Managers can view org insights"
  ON public.analytics_insights FOR SELECT
  USING (is_manager_or_higher(organization_id, auth.uid()));

-- System/service role can manage all insights (for edge functions)
CREATE POLICY "Service role can manage insights"
  ON public.analytics_insights FOR ALL
  USING (auth.role() = 'service_role');

-- Create staff_performance table for daily staff metrics
CREATE TABLE public.staff_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period_date date NOT NULL,
  customers_served integer DEFAULT 0,
  avg_service_time_minutes numeric(6,2),
  avg_wait_time_minutes numeric(6,2),
  completion_rate numeric(5,2),
  efficiency_score numeric(5,2),
  rank_in_org integer,
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(staff_user_id, organization_id, period_date)
);

-- Create indexes
CREATE INDEX idx_staff_perf_org ON public.staff_performance(organization_id);
CREATE INDEX idx_staff_perf_user ON public.staff_performance(staff_user_id);
CREATE INDEX idx_staff_perf_date ON public.staff_performance(period_date DESC);

-- Enable RLS
ALTER TABLE public.staff_performance ENABLE ROW LEVEL SECURITY;

-- Managers can view org performance
CREATE POLICY "Managers can view org performance"
  ON public.staff_performance FOR SELECT
  USING (is_manager_or_higher(organization_id, auth.uid()));

-- Staff can view own performance
CREATE POLICY "Staff can view own performance"
  ON public.staff_performance FOR SELECT
  USING (staff_user_id = auth.uid());

-- Service role can manage all performance data
CREATE POLICY "Service role can manage performance"
  ON public.staff_performance FOR ALL
  USING (auth.role() = 'service_role');

-- Create export_logs table to track CSV exports
CREATE TABLE public.export_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  export_type text NOT NULL,
  file_hash text,
  row_count integer,
  status text DEFAULT 'pending',
  error_message text,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idx_export_logs_org ON public.export_logs(organization_id);
CREATE INDEX idx_export_logs_status ON public.export_logs(status);

ALTER TABLE public.export_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view export logs"
  ON public.export_logs FOR SELECT
  USING (is_manager_or_higher(organization_id, auth.uid()));

CREATE POLICY "Service role can manage export logs"
  ON public.export_logs FOR ALL
  USING (auth.role() = 'service_role');

-- Add subscription_tier to clients for future premium features
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS subscription_tier text DEFAULT 'free';