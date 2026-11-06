-- Proves the hook, with no user created and no text sent. Paste into the Supabase SQL
-- editor after the migration: it raises an error if anything is wrong, and otherwise
-- ends with "require_email_on_signup: all checks passed".
do $$
declare r jsonb;
begin
  r := public.hook_require_email_on_signup('{"user":{"email":"new.client@example.com"}}');
  assert r = '{}'::jsonb, 'email sign-up must be allowed';
  r := public.hook_require_email_on_signup('{"user":{"email":"new.client@example.com","phone":"18765550100"}}');
  assert r = '{}'::jsonb, 'an email with a phone must be allowed';
  r := public.hook_require_email_on_signup('{"user":{"phone":"18765550100"}}');
  assert (r->'error'->>'http_code') = '403', 'phone-only sign-up must be refused';
  r := public.hook_require_email_on_signup('{"user":{"email":"","phone":"18765550100"}}');
  assert (r->'error'->>'http_code') = '403', 'an empty email must be refused';
  r := public.hook_require_email_on_signup('{"user":{"email":"   ","phone":"18765550100"}}');
  assert (r->'error'->>'http_code') = '403', 'a blank email must be refused';
  r := public.hook_require_email_on_signup('{"user":{}}');
  assert (r->'error'->>'http_code') = '403', 'no details at all must be refused';
  raise notice 'require_email_on_signup: all checks passed';
end $$;
select 'require_email_on_signup: all checks passed' as result;
