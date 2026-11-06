-- Lyne accounts are email accounts. A phone number is something an existing account
-- adds and verifies; it never creates one. Supabase's Phone provider, once enabled,
-- would otherwise let anyone with the public anon key create an account from a phone
-- number alone, and every attempt would cost a text.
--
-- This is a "before user created" Auth Hook. It only takes effect once it is switched
-- on in Dashboard > Authentication > Auth Hooks. Applying this file does not do that.
create or replace function public.hook_require_email_on_signup(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  email text := nullif(btrim(coalesce(event->'user'->>'email', '')), '');
begin
  if email is null then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'Sign up with your email address. You can add a phone number afterwards.'
    ));
  end if;
  return '{}'::jsonb;
end;
$$;

-- Only Supabase Auth may call it.
grant execute on function public.hook_require_email_on_signup(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_require_email_on_signup(jsonb) from authenticated, anon, public;
