#!/usr/bin/env bash
# End-to-end proof of the sign-up hook, against the real Supabase project.
#
# RUN ONLY AFTER THE HOOK IS SWITCHED ON. If it is off, the phone test really creates
# an account and really sends a paid text.
#
#   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_ANON_KEY=... TEST_EMAIL=you+hooktest@gmail.com \
#     bash scripts/test-signup-hook.sh
#
# TEST_EMAIL must be a real inbox of yours: Supabase emails it a confirmation. Delete
# that test user in Dashboard > Authentication > Users afterwards.
set -euo pipefail
: "${SUPABASE_URL:?}" "${SUPABASE_ANON_KEY:?}" "${TEST_EMAIL:?}"
post() { curl -s -o /tmp/hook-test.out -w '%{http_code}' "$SUPABASE_URL/auth/v1/signup" \
  -H "apikey: $SUPABASE_ANON_KEY" -H 'Content-Type: application/json' -d "$1"; }

phone=$(post '{"phone":"+18765550100","password":"Hook-test-1234"}')
echo "phone-only sign-up: HTTP $phone (expect 403)"; cat /tmp/hook-test.out; echo
email=$(post "{\"email\":\"$TEST_EMAIL\",\"password\":\"Hook-test-1234\"}")
echo "email sign-up:      HTTP $email (expect 200)"
rm -f /tmp/hook-test.out
[ "$phone" = 403 ] && [ "$email" = 200 ] && echo "PASS" || { echo "FAIL"; exit 1; }
