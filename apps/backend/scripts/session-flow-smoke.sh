#!/bin/bash
# Walks the motorist's whole path through the session API, as an anonymous
# browser with no account — the only path a court can actually rely on.
API=http://localhost:4000/api
S=ses-court-sat
pass=0; fail=0

# Re-runnable: put the sitting back the way the seed leaves it, and drop
# anything a previous run created.
docker exec lyne_demo_db mysql -uroot -prootpassword lyne -e "
  DELETE FROM queue_tickets WHERE id IN (SELECT queue_ticket_id FROM (SELECT queue_ticket_id FROM session_registrations WHERE session_id='ses-court-sat' AND queue_ticket_id IS NOT NULL) x);
  DELETE FROM session_registrations WHERE session_id='ses-court-sat' AND id NOT LIKE 'reg-court-sat-%';
  UPDATE session_registrations SET status='registered', checked_in_at=NULL, queue_ticket_id=NULL WHERE session_id='ses-court-sat';
  DELETE FROM session_cause_list WHERE session_id='ses-court-sat';
  UPDATE scheduled_sessions SET status='open', session_date=DATE_ADD(CURDATE(), INTERVAL ((7 - WEEKDAY(CURDATE()) + 5) % 7) DAY),
    registration_opens_at=DATE_SUB(NOW(), INTERVAL 5 DAY),
    registration_closes_at=DATE_ADD(NOW(), INTERVAL 1 DAY) WHERE id='ses-court-sat';" 2>/dev/null
check() { # check <name> <expected-substring> <actual>
  if [[ "$3" == *"$2"* ]]; then echo "  PASS  $1"; pass=$((pass+1));
  else echo "  FAIL  $1"; echo "        wanted: $2"; echo "        got:    ${3:0:400}"; fail=$((fail+1)); fi
}

echo "── 1 · The session is publicly findable"
r=$(curl -s "$API/sessions/public/$S")
check "session loads"                 '"id":"ses-court-sat"' "$r"
SAT=$(docker exec lyne_demo_db mysql -uroot -prootpassword lyne -N -B -e "SELECT DATE_FORMAT(session_date,'%Y-%m-%d') FROM scheduled_sessions WHERE id='ses-court-sat'" 2>/dev/null | tr -d '\r')
check "date is a plain calendar date"  "\"session_date\":\"$SAT\"" "$r"
check "em-dash survived the import"   'Sitting — Camp Road' "$r"
check "speaks court, not retail"      '"many":"Court Users"' "$r"
check "asks for a Ticket Number"      '"label":"Ticket Number"' "$r"
check "places left are real"          '"places_remaining":313' "$r"

echo "── 2 · Eligibility with NO cause list loaded (rule 1: degrade, do not block)"
r=$(curl -s -X POST "$API/sessions/public/$S/eligibility" -H 'Content-Type: application/json' \
    -d '{"reference":"TKT-777001","surname":"Wright"}')
check "admitted"                      '"eligible":true' "$r"
check "but NOT claimed as verified"   '"verified":false' "$r"
check "and says so plainly"           '"checked_against_list":false' "$r"

echo "── 3 · Load the day's cause list (staff only — anonymous must be refused)"
r=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/sessions/$S/cause-list" \
    -H 'Content-Type: application/json' -d '{"entries":[{"reference":"X"}]}')
check "anonymous import refused"      '401' "$r"

echo "── 4 · Eligibility once a list exists"
docker exec lyne_demo_db mysql -uroot -prootpassword --default-character-set=utf8mb4 lyne -e "
  DELETE FROM session_cause_list WHERE session_id='$S';
  INSERT INTO session_cause_list (id,session_id,reference,reference_key,party_surname,division)
  VALUES (UUID(),'$S','TKT-777001','TKT777001','Wright','Court 3');" 2>/dev/null

r=$(curl -s -X POST "$API/sessions/public/$S/eligibility" -H 'Content-Type: application/json' \
    -d '{"reference":"tkt 777001","surname":"wright"}')
check "listed ticket, typed messily" '"eligible":true' "$r"
check "now genuinely verified"       '"verified":true' "$r"
check "told which room to go to"     '"division":"Court 3"' "$r"

r=$(curl -s -X POST "$API/sessions/public/$S/eligibility" -H 'Content-Type: application/json' \
    -d '{"reference":"TKT-999999","surname":"Wright"}')
check "unlisted ticket refused"      '"eligible":false' "$r"

r2=$(curl -s -X POST "$API/sessions/public/$S/eligibility" -H 'Content-Type: application/json' \
    -d '{"reference":"TKT-777001","surname":"Campbell"}')
check "wrong surname refused"        '"eligible":false' "$r2"
if [[ "$r" == "$r2" ]]; then echo "  PASS  no enumeration oracle (both failures identical)"; pass=$((pass+1));
else echo "  FAIL  failure messages differ — that confirms the ticket exists"; fail=$((fail+1)); fi

echo "── 5 · Register and get an access code"
r=$(curl -s -X POST "$API/sessions/public/$S/register" -H 'Content-Type: application/json' \
    -d '{"reference":"TKT-777001","surname":"Wright","name":"Delroy Wright","phone":"876-555-0111"}')
check "registered"                   '"verified":true' "$r"
CODE=$(echo "$r" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("registration_code",""))')
[[ -n "$CODE" ]] && { echo "  PASS  access code issued: $CODE"; pass=$((pass+1)); } || { echo "  FAIL  no code"; fail=$((fail+1)); }

r=$(curl -s -X POST "$API/sessions/public/$S/register" -H 'Content-Type: application/json' \
    -d '{"reference":"tkt777001","surname":"Wright","name":"Delroy Wright"}')
check "re-registering returns the SAME code, not a second place" "\"registration_code\":\"$CODE\"" "$r"
check "and says so"                  '"already_registered":true' "$r"

echo "── 6 · Check-in before the day is refused"
r=$(curl -s -X POST "$API/sessions/public/$S/check-in" -H 'Content-Type: application/json' \
    -d "{\"code\":\"$CODE\"}")
check "too early to check in"        'opens on the day' "$r"

echo "── 7 · Move the sitting to today, then check in for real"
docker exec lyne_demo_db mysql -uroot -prootpassword lyne -e \
  "UPDATE scheduled_sessions SET session_date=CURDATE() WHERE id='$S';" 2>/dev/null

r=$(curl -s -X POST "$API/sessions/public/$S/check-in" -H 'Content-Type: application/json' \
    -d "{\"code\":\"$(echo "$CODE" | tr 'A-Z' 'a-z')\"}")
check "a real queue ticket comes out" '"ticket_number":"PAY-' "$r"
check "it is waiting in a line"       '"status":"waiting"' "$r"
check "guest gets a token to return with" '"guest_access_token":"' "$r"
TICKET=$(echo "$r" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("ticket",{}).get("id",""))')
TOKEN=$(echo "$r" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("guest_access_token") or "")')

r=$(curl -s -X POST "$API/sessions/public/$S/check-in" -H 'Content-Type: application/json' \
    -d "{\"code\":\"$CODE\"}")
check "checking in twice is idempotent" '"already_checked_in":true' "$r"

r=$(curl -s -X POST "$API/sessions/public/$S/check-in" -H 'Content-Type: application/json' -d '{"code":"ZZZZ-9999"}')
check "an unknown code is rejected"   'not recognised' "$r"

echo "── 8 · The ticket is now an ORDINARY ticket — the seam holds"
r=$(curl -s "$API/tickets/$TICKET")
check "an id alone gets you nothing"        'Missing or invalid Authorization' "$r"
r=$(curl -s "$API/tickets/guest/$TOKEN")
check "the guest token opens their own ticket" '"ticket_number":"PAY-' "$r"
check "with a live position"                '"waiting_position"' "$r"
if [[ "$r" != *verification_code* ]]; then echo "  PASS  verification_code stays server-side"; pass=$((pass+1));
else echo "  FAIL  guest view leaks verification_code"; fail=$((fail+1)); fi
r=$(curl -s "$API/tickets/guest/DKChhIZ4NfIBJQ1reAxkDB9NXz7wQ72CmEU7Lc0UHWY")
check "a wrong token gets nothing"          'Ticket not found' "$r"

echo "── 9 · The session reflects the check-in"
r=$(curl -s "$API/sessions/public/$S")
check "one person checked in"        '"checked_in_count":1' "$r"
check "session flipped to running"   '"status":"in_progress"' "$r"

echo
echo "──────────────────────────────────────────"
echo "  $pass passed, $fail failed"
[[ $fail -eq 0 ]] || exit 1
