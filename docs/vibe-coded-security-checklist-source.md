# Source: The Complete Pre-Launch Security Checklist for Vibe-Coded Apps

Captured 2026-08-23 from the Notion page Debra supplied. This is the SOURCE
material — the working status lives in `pre-launch-security-checklist.md`.

## Start here (the 7)
1. Keep every API key and secret on the server, never in frontend code
2. Use your database public key on the frontend, never the admin key
3. Turn on row-level security for every database table
4. Confirm each user can only reach their own records
5. Rate-limit your API, especially login and anything that costs money per call
6. Set billing caps and alerts on every paid service
7. Use parameterized queries so user input can never run as a command

## Full list, by category
**Secrets and keys** — 1 keys on server · 2 secrets out of git history · 3 public DB key on frontend
**Database** — 4 row-level security every table · 5 encrypt sensitive data
**Auth and access control** — 6 enforce auth on the server · 7 check record ownership · 8 only accept fields the user may change (mass assignment) · 9 session tokens in secure cookies, not localStorage · 10 hash passwords
**Rate limiting and abuse** — 11 rate-limit the API · 12 billing caps and alerts · 13 bot protection on public forms
**Input and output** — 14 parameterized queries · 15 validate and sanitize input · 16 escape user content (XSS) · 17 lock down file uploads · 18 do not return more data than the screen needs
**Payments** — 19 verify payment webhook signatures · 20 set prices on the server, never from the client
**AI features** — 21 defend against prompt injection and unsafe output · 22 cap AI usage per user
**Deployment and ops** — 23 force HTTPS · 24 security headers · 25 debug mode off, source maps and .git not exposed · 26 secrets out of error messages · 27 dependencies updated · 28 logging and monitoring, no secrets in logs · 29 automatic backups · 30 two-factor on your own accounts

## Mobile section
- Keep API keys out of the app bundle
- Store tokens in secure storage, not AsyncStorage
- Validate deep links
- Do not rely on biometrics alone for sensitive actions
