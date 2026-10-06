# Release validation — October 7, 2026 (Asia/Kolkata)

These tests use disposable local databases and fictional identities. No production Firebase records, Razorpay payments or client traffic were stress-tested. Authentication/payment transport uses protocol fixtures. This report is not a production capacity certificate.

| Database | Requests | p95 at 50 concurrent read requests | Local read requests/second at 50 | Short soak duration | Passed |
| --- | ---: | ---: | ---: | ---: | --- |
| in-memory SQLite | 1094 | 58.9 ms | 1623.5 | 20.4 s | true |
| local Firestore emulator; isolated demo-anvira-load | 1094 | 121.2 ms | 657.7 | 21.5 s | true |

The read ramp runs 120 mixed catalog, account-state and readiness requests at concurrency 1, 10, 25 and 50. Each run then checks concurrent writes, webhooks, a 320-request paced soak and an intentional burst that triggers rate limits. These are short local runs; they do not establish sustained production capacity, WAN latency, real Firebase quotas, real payment latency, autoscaling or client device limits. Normal request stages and soak produced no server errors; expected slot conflicts and rate-limit rejections are passing protections.

Verified invariants:

- 20 concurrent identical checkouts produce exactly one booking
- 30 competing checkouts reserve one professional slot exactly once; 29 receive availability conflicts
- 20 repeated signed provider events confirm one payment and deduplicate once
- Unknown provider order cannot mark a booking paid
- Account burst protection returns 429 without server errors

Firestore security-rule tests also verify that direct customer/Owner datastore access is denied, server aggregation includes more than the dashboard list limit, reservations respect two professionals and duplicate checkout/pagination behave correctly. Backend checks, browser result summaries and Expo SDK checks are reported separately in the launch handoff.

The dependency audit dropped from 44 findings to 34 (25 high, 9 moderate) after compatible FTP/OpenTelemetry/URI-decoder updates and Expo SDK 57 patch updates. The decoder uses its fixed upstream release plus a small CommonJS/ES-module adapter for Router compatibility. Remaining advisories involve braces, node-forge and older UUID dependencies and propagate through dependent packages; the finding count is not a count of distinct bugs. No fixed compatible published braces/node-forge versions were available during this check. Do not downgrade Expo or force incompatible upgrades to hide findings. Review build/runtime reachability and mitigations with the release owner before customer launch.

Before launch, repeat this suite against an isolated deployed staging API with the chosen host, realistic dataset, real Firebase Auth, approved service capacity and real Razorpay test keys. Test sessions/CSRF through Vercel proxy, cross-user isolation, signed webhooks, expiry/refund/reconciliation, host restart/failure, restore, uploads, alert delivery and physical Android/iOS devices. Define customer traffic and acceptable latency/error targets from the client business model and perform a longer soak and distributed traffic test within provider quotas.
