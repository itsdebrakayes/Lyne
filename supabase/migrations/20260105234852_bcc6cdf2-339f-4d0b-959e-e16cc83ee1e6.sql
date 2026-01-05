-- =============================================
-- PHASE 1: Fix RLS Infinite Recursion
-- =============================================

-- Create security definer function to get client's user_id without triggering RLS
CREATE OR REPLACE FUNCTION public.get_client_user_id(p_client_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT user_id FROM clients WHERE id = p_client_id
$$;

-- Create function to check if client is in org queue
CREATE OR REPLACE FUNCTION public.client_in_org_queue(p_client_id uuid, p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM lines 
    WHERE client_id = p_client_id 
    AND organization_id = p_org_id
  )
$$;

-- Drop problematic policies on lines table
DROP POLICY IF EXISTS "Users can view own lines" ON public.lines;
DROP POLICY IF EXISTS "Users can cancel own line" ON public.lines;

-- Recreate policies using security definer functions
CREATE POLICY "Users can view own lines" ON public.lines
  FOR SELECT USING (public.get_client_user_id(client_id) = auth.uid());

CREATE POLICY "Users can cancel own line" ON public.lines
  FOR UPDATE USING (public.get_client_user_id(client_id) = auth.uid());

-- Drop and recreate problematic clients policy
DROP POLICY IF EXISTS "Managers can view org clients" ON public.clients;

CREATE POLICY "Managers can view org clients" ON public.clients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organizations o
      WHERE is_manager_or_higher(auth.uid(), o.id)
      AND public.client_in_org_queue(clients.id, o.id)
    )
  );

-- =============================================
-- PHASE 2: Add branch_id to lines table
-- =============================================
ALTER TABLE public.lines ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id);

-- =============================================
-- PHASE 3: Insert 50 Test Clients
-- =============================================
INSERT INTO public.clients (full_name, email, phone, id_number, trn_number, date_of_birth) VALUES
('Devon Williams', 'devon.williams@email.com', '876-555-0101', 'JM1234567', '123456789', '1985-03-15'),
('Shanice Brown', 'shanice.brown@email.com', '876-555-0102', 'JM2345678', '234567890', '1990-07-22'),
('Ricardo Campbell', 'ricardo.campbell@email.com', '876-555-0103', 'JM3456789', '345678901', '1978-11-08'),
('Keisha Thompson', 'keisha.thompson@email.com', '876-555-0104', 'JM4567890', '456789012', '1995-02-28'),
('Andre Davis', 'andre.davis@email.com', '876-555-0105', 'JM5678901', '567890123', '1982-09-14'),
('Camille Johnson', 'camille.johnson@email.com', '876-555-0106', 'JM6789012', '678901234', '1988-04-03'),
('Omar Mitchell', 'omar.mitchell@email.com', '876-555-0107', 'JM7890123', '789012345', '1975-12-19'),
('Tanya Robinson', 'tanya.robinson@email.com', '876-555-0108', 'JM8901234', '890123456', '1992-06-11'),
('Marcus Lewis', 'marcus.lewis@email.com', '876-555-0109', 'JM9012345', '901234567', '1980-01-25'),
('Nadine Clarke', 'nadine.clarke@email.com', '876-555-0110', 'JM0123456', '012345678', '1987-08-07'),
('Damion Wright', 'damion.wright@email.com', '876-555-0111', 'JM1122334', '112233445', '1993-10-30'),
('Simone Harris', 'simone.harris@email.com', '876-555-0112', 'JM2233445', '223344556', '1986-05-17'),
('Gareth Martin', 'gareth.martin@email.com', '876-555-0113', 'JM3344556', '334455667', '1979-02-09'),
('Patrice Jackson', 'patrice.jackson@email.com', '876-555-0114', 'JM4455667', '445566778', '1991-11-23'),
('Leroy White', 'leroy.white@email.com', '876-555-0115', 'JM5566778', '556677889', '1984-07-04'),
('Marcia Thomas', 'marcia.thomas@email.com', '876-555-0116', 'JM6677889', '667788990', '1977-03-28'),
('Courtney Moore', 'courtney.moore@email.com', '876-555-0117', 'JM7788990', '778899001', '1996-09-12'),
('Donna Taylor', 'donna.taylor@email.com', '876-555-0118', 'JM8899001', '889900112', '1983-12-06'),
('Jermaine Anderson', 'jermaine.anderson@email.com', '876-555-0119', 'JM9900112', '990011223', '1989-04-21'),
('Crystal Wilson', 'crystal.wilson@email.com', '876-555-0120', 'JM0011223', '001122334', '1994-08-15'),
('Rohan Edwards', 'rohan.edwards@email.com', '876-555-0121', 'JM1234001', '123400156', '1981-06-02'),
('Shelly Morgan', 'shelly.morgan@email.com', '876-555-0122', 'JM2345002', '234500267', '1976-10-18'),
('Dwayne Bailey', 'dwayne.bailey@email.com', '876-555-0123', 'JM3456003', '345600378', '1998-01-09'),
('Althea Richards', 'althea.richards@email.com', '876-555-0124', 'JM4567004', '456700489', '1985-05-27'),
('Everton Grant', 'everton.grant@email.com', '876-555-0125', 'JM5678005', '567800590', '1972-09-03'),
('Pauline Young', 'pauline.young@email.com', '876-555-0126', 'JM6789006', '678900601', '1990-02-14'),
('Horace King', 'horace.king@email.com', '876-555-0127', 'JM7890007', '789000712', '1968-07-31'),
('Winsome Scott', 'winsome.scott@email.com', '876-555-0128', 'JM8901008', '890100823', '1997-11-05'),
('Delroy Green', 'delroy.green@email.com', '876-555-0129', 'JM9012009', '901200934', '1974-04-16'),
('Beverley Adams', 'beverley.adams@email.com', '876-555-0130', 'JM0123010', '012301045', '1988-08-22'),
('Neville Nelson', 'neville.nelson@email.com', '876-555-0131', 'JM1234011', '123401156', '1965-12-29'),
('Sonia Hill', 'sonia.hill@email.com', '876-555-0132', 'JM2345012', '234501267', '1999-03-08'),
('Carlton Baker', 'carlton.baker@email.com', '876-555-0133', 'JM3456013', '345601378', '1982-06-19'),
('Denise Hall', 'denise.hall@email.com', '876-555-0134', 'JM4567014', '456701489', '1971-10-24'),
('Fitzroy Allen', 'fitzroy.allen@email.com', '876-555-0135', 'JM5678015', '567801590', '1995-01-11'),
('Gloria Walters', 'gloria.walters@email.com', '876-555-0136', 'JM6789016', '678901601', '1986-05-06'),
('Kenroy James', 'kenroy.james@email.com', '876-555-0137', 'JM7890017', '789001712', '1979-09-28'),
('Maxine Watson', 'maxine.watson@email.com', '876-555-0138', 'JM8901018', '890101823', '1992-02-03'),
('Patrick Brooks', 'patrick.brooks@email.com', '876-555-0139', 'JM9012019', '901201934', '1967-07-15'),
('Sheila Kelly', 'sheila.kelly@email.com', '876-555-0140', 'JM0123020', '012302045', '2000-11-20'),
('Winston Price', 'winston.price@email.com', '876-555-0141', 'JM1234021', '123402156', '1984-04-07'),
('Yvonne Bennett', 'yvonne.bennett@email.com', '876-555-0142', 'JM2345022', '234502267', '1973-08-12'),
('Barrington Wood', 'barrington.wood@email.com', '876-555-0143', 'JM3456023', '345602378', '1991-12-25'),
('Claudette Barnes', 'claudette.barnes@email.com', '876-555-0144', 'JM4567024', '456702489', '1978-03-18'),
('Errol Ross', 'errol.ross@email.com', '876-555-0145', 'JM5678025', '567802590', '1996-06-09'),
('Francine Henderson', 'francine.henderson@email.com', '876-555-0146', 'JM6789026', '678902601', '1969-10-31'),
('Gregory Coleman', 'gregory.coleman@email.com', '876-555-0147', 'JM7890027', '789002712', '1987-01-23'),
('Hyacinth Jenkins', 'hyacinth.jenkins@email.com', '876-555-0148', 'JM8901028', '890102823', '1980-05-14'),
('Ivan Perry', 'ivan.perry@email.com', '876-555-0149', 'JM9012029', '901202934', '1993-09-06'),
('Janet Powell', 'janet.powell@email.com', '876-555-0150', 'JM0123030', '012303045', '1976-02-19');

-- =============================================
-- PHASE 4: Insert Visit History (130+ rows)
-- =============================================

-- Get organization and service IDs for reference
DO $$
DECLARE
  taj_id uuid;
  nht_id uuid;
  pica_id uuid;
  taj_services uuid[];
  nht_services uuid[];
  pica_services uuid[];
  client_ids uuid[];
  i int;
  random_client uuid;
  random_service uuid;
  visit_date date;
  visit_hour int;
BEGIN
  -- Get org IDs
  SELECT id INTO taj_id FROM organizations WHERE slug = 'taj';
  SELECT id INTO nht_id FROM organizations WHERE slug = 'nht';
  SELECT id INTO pica_id FROM organizations WHERE slug = 'pica';
  
  -- Get service IDs for each org
  SELECT array_agg(id) INTO taj_services FROM services WHERE organization_id = taj_id;
  SELECT array_agg(id) INTO nht_services FROM services WHERE organization_id = nht_id;
  SELECT array_agg(id) INTO pica_services FROM services WHERE organization_id = pica_id;
  
  -- Get client IDs
  SELECT array_agg(id) INTO client_ids FROM clients LIMIT 50;
  
  -- Insert TAJ visits (60 records)
  FOR i IN 1..60 LOOP
    random_client := client_ids[1 + floor(random() * array_length(client_ids, 1))::int];
    random_service := taj_services[1 + floor(random() * array_length(taj_services, 1))::int];
    visit_date := CURRENT_DATE - (floor(random() * 30)::int);
    visit_hour := 8 + floor(random() * 8)::int;
    
    INSERT INTO visit_history (organization_id, client_id, service_id, visit_date, day_of_week, hour_of_day, wait_time_minutes, service_time_minutes, was_no_show, was_cancelled)
    VALUES (
      taj_id,
      random_client,
      random_service,
      visit_date,
      EXTRACT(DOW FROM visit_date)::int,
      visit_hour,
      5 + floor(random() * 40)::int,
      5 + floor(random() * 25)::int,
      random() < 0.05,
      random() < 0.03
    );
  END LOOP;
  
  -- Insert NHT visits (40 records)
  FOR i IN 1..40 LOOP
    random_client := client_ids[1 + floor(random() * array_length(client_ids, 1))::int];
    random_service := nht_services[1 + floor(random() * array_length(nht_services, 1))::int];
    visit_date := CURRENT_DATE - (floor(random() * 30)::int);
    visit_hour := 8 + floor(random() * 8)::int;
    
    INSERT INTO visit_history (organization_id, client_id, service_id, visit_date, day_of_week, hour_of_day, wait_time_minutes, service_time_minutes, was_no_show, was_cancelled)
    VALUES (
      nht_id,
      random_client,
      random_service,
      visit_date,
      EXTRACT(DOW FROM visit_date)::int,
      visit_hour,
      5 + floor(random() * 35)::int,
      8 + floor(random() * 20)::int,
      random() < 0.05,
      random() < 0.03
    );
  END LOOP;
  
  -- Insert PICA visits (30 records)
  FOR i IN 1..30 LOOP
    random_client := client_ids[1 + floor(random() * array_length(client_ids, 1))::int];
    random_service := pica_services[1 + floor(random() * array_length(pica_services, 1))::int];
    visit_date := CURRENT_DATE - (floor(random() * 30)::int);
    visit_hour := 8 + floor(random() * 8)::int;
    
    INSERT INTO visit_history (organization_id, client_id, service_id, visit_date, day_of_week, hour_of_day, wait_time_minutes, service_time_minutes, was_no_show, was_cancelled)
    VALUES (
      pica_id,
      random_client,
      random_service,
      visit_date,
      EXTRACT(DOW FROM visit_date)::int,
      visit_hour,
      5 + floor(random() * 30)::int,
      10 + floor(random() * 20)::int,
      random() < 0.05,
      random() < 0.03
    );
  END LOOP;
END $$;

-- =============================================
-- PHASE 5: Insert Visitor Sessions (Analytics - 100 rows)
-- =============================================

DO $$
DECLARE
  taj_id uuid;
  nht_id uuid;
  pica_id uuid;
  taj_services uuid[];
  nht_services uuid[];
  pica_services uuid[];
  i int;
  session_start timestamp;
  duration_sec int;
  org_id uuid;
  services_arr uuid[];
BEGIN
  SELECT id INTO taj_id FROM organizations WHERE slug = 'taj';
  SELECT id INTO nht_id FROM organizations WHERE slug = 'nht';
  SELECT id INTO pica_id FROM organizations WHERE slug = 'pica';
  
  SELECT array_agg(id) INTO taj_services FROM services WHERE organization_id = taj_id;
  SELECT array_agg(id) INTO nht_services FROM services WHERE organization_id = nht_id;
  SELECT array_agg(id) INTO pica_services FROM services WHERE organization_id = pica_id;
  
  FOR i IN 1..100 LOOP
    -- Random org
    CASE floor(random() * 3)::int
      WHEN 0 THEN org_id := taj_id; services_arr := taj_services;
      WHEN 1 THEN org_id := nht_id; services_arr := nht_services;
      ELSE org_id := pica_id; services_arr := pica_services;
    END CASE;
    
    session_start := NOW() - (random() * interval '30 days');
    duration_sec := 30 + floor(random() * 570)::int;
    
    INSERT INTO visitor_sessions (organization_id, session_start, session_end, duration_seconds, services_viewed, did_join, device_info)
    VALUES (
      org_id,
      session_start,
      session_start + (duration_sec || ' seconds')::interval,
      duration_sec,
      to_jsonb(ARRAY[services_arr[1 + floor(random() * array_length(services_arr, 1))::int]::text]),
      random() < 0.4,
      CASE WHEN random() < 0.6 THEN 'Mobile - iOS' WHEN random() < 0.8 THEN 'Mobile - Android' ELSE 'Desktop - Chrome' END
    );
  END LOOP;
END $$;

-- =============================================
-- PHASE 6: Update Organization Logos
-- =============================================

UPDATE organizations SET logo_url = '/assets/logos/taj-logo.png' WHERE slug = 'taj';
UPDATE organizations SET logo_url = '/assets/logos/nht-logo.png' WHERE slug = 'nht';
UPDATE organizations SET logo_url = '/assets/logos/pica-logo.png' WHERE slug = 'pica';