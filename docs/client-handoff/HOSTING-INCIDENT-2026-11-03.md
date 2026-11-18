# API 429 investigation — 3 November 2026

The website's proxied `/api/public` and `/api/csrf` returned HTTP429 with an HTML “Just a moment…” response, `cf-mitigated: challenge`, and Cloudflare Ray ID `a54aebba68ef17df-BOM`. This is an upstream hosting challenge, not ANVIRA's JSON `RATE_LIMITED` response. The exact provider trigger has not been confirmed.

After the backend became available, the direct Render API and website proxy both returned HTTP200. The application limiter then showed 1199 of 1200 requests remaining. This establishes recovery at that time, not a guarantee that the upstream restriction cannot recur.

Render documents that its free services have lower inbound limits and can return429 during rate limiting or DDoS mitigation: https://render.com/docs/troubleshooting-deploys#429-too-many-requests. Its free idle shutdown is a separate limitation: https://render.com/docs/free#spinning-down-on-idle.

The client update distinguishes provider HTML429 from application JSON429, honours `Retry-After`, and uses a 60-second cooldown when the provider supplies no deadline. That fallback is a client backoff interval, not a promise that the provider will unblock after60 seconds. API reads, polling and business writes share the cooldown. Already scheduled gateway retries also check it, and overlapping429 responses retain the longest deadline. User-requested logout and its secure-session preparation remain possible; no business mutation is automatically replayed.

Sign-in preserves entered credentials, displays a countdown and waits for a manual retry after cooldown. Security protections were not disabled and no paid hosting was selected. Persistent provider challenges require investigation with Render using the captured timestamp/Ray ID; no support message has been sent.
