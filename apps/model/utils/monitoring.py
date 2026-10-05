"""monitoring.py — Sentry wiring for the Python model worker.

The Node side of this lives in apps/backend/src/lib/monitoring.js and the mobile
side in apps/mobile/src/lib/monitoring.ts. All three agree on the rule that
matters: NO DSN MEANS NOTHING HAPPENS. No init, no network, no handlers, and
no warning on stderr either — a worker without a DSN must behave exactly as it
did before this file existed, because that is every developer machine.

The worker is tagged separately from the API. Both report into one project, so
one alert rule covers the platform, and `service:model-worker` is what tells you
the models stopped rather than the queues.

WHAT IS NOT SENT: this process holds MYSQL_PASSWORD, the Supabase anon key and
the pipeline account's password, and it reads every customer row in the
database to train on. So default PII is off and a scrubber runs over anything
attached to an event. There is no request context here to leak, which removes a
whole class of the problem, but the environment and local variables are still
reachable from a traceback — hence send_default_pii=False and the explicit
with_locals=False below.
"""

import os
import re

# Keys whose values must never leave this process. Kept in step with the
# SENSITIVE regex in apps/backend/src/lib/monitoring.js.
_SENSITIVE = re.compile(
    r"(trn|national_?id|passport|nin|verification_?code|password|token|authorization"
    r"|cookie|api[-_]?key|secret|service[-_]?key|anon[-_]?key|publishable|dsn|mysql"
    r"|database[-_]?url|conn(ection)?[-_]?string|email|phone|date_?of_?birth|dob|address)",
    re.IGNORECASE,
)

_DSN = (os.getenv("SENTRY_DSN") or "").strip()

#: The single switch. Everything here checks it first.
monitoring_enabled = _DSN.startswith("http")


def _scrub(value, depth=0):
    if depth > 6 or value is None:
        return value
    if isinstance(value, dict):
        return {
            k: "[redacted]" if _SENSITIVE.search(str(k)) else _scrub(v, depth + 1)
            for k, v in value.items()
        }
    if isinstance(value, (list, tuple)):
        return [_scrub(v, depth + 1) for v in value]
    return value


def _before_send(event, _hint):
    for key in ("extra", "tags", "contexts"):
        if event.get(key):
            event[key] = _scrub(event[key])

    # The worker runs as nobody in particular. Strip any user Sentry inferred.
    event.pop("user", None)

    # A traceback's frame locals can hold a whole DataFrame of customer rows.
    for exc in (event.get("exception") or {}).get("values") or []:
        for frame in (exc.get("stacktrace") or {}).get("frames") or []:
            frame.pop("vars", None)

    return event


def init_monitoring(service="model-worker"):
    """Initialise Sentry, or do nothing at all. Returns whether it is on."""
    if not monitoring_enabled:
        return False

    try:
        import sentry_sdk
    except ImportError:
        # A DSN was set but the dependency is missing. Say so once and carry on
        # running the models — reporting is not worth taking the worker down.
        print("[worker] SENTRY_DSN is set but sentry-sdk is not installed; "
              "error reporting is off", flush=True)
        return False

    sentry_sdk.init(
        dsn=_DSN,
        environment=(os.getenv("NODE_ENV") or os.getenv("SENTRY_ENVIRONMENT") or "production").strip(),
        release=(os.getenv("SENTRY_RELEASE") or "").strip() or None,
        send_default_pii=False,
        # Sampled, not exhaustive: this is billed per event and a worker that
        # runs seven models every two hours would otherwise be noisy and costly.
        traces_sample_rate=0.2,
        # Frame locals are where a model's training frame would leak.
        include_local_variables=False,
        before_send=_before_send,
    )
    sentry_sdk.set_tag("service", service)
    return True


def report_handled(error, **context):
    """Report a failure the worker caught and recovered from."""
    if not monitoring_enabled:
        return
    try:
        import sentry_sdk
        with sentry_sdk.new_scope() as scope:
            for key, value in _scrub(context).items():
                scope.set_extra(key, value)
            sentry_sdk.capture_exception(error)
    except Exception:  # noqa: BLE001
        # Reporting must never be the reason a model run fails.
        pass
