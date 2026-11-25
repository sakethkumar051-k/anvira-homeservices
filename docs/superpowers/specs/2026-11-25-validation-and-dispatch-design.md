# Clear validation and automatic dispatch

User approved the conversational plan and instructed implementation on 25 November 2026.

1. Monthly Car Care requests must explain required fields, show validation beside fields and on submit, preserve inputs on failure and never start billing when requesting a plan. Audit customer, professional and admin actions for silent disabled states; loading-only blocking remains appropriate.
2. Opt-in automatic office dispatch assigns an eligible internal worker after successful payment, respecting exact service, PIN, schedule, leave and booking locks. Otherwise approved eligible outside professionals receive bounded offers. First valid acceptance wins transactionally.
3. Recommended policy: five professionals per round, 90-second windows, two rounds, total escalation deadline three minutes. Existing manual mode remains available. No automatic refund/cancellation added. Closing the admin UI never changes availability.
4. Recheck capacity at every retry. Explicit availability controls govern matching. Do not move an assigned/started job simply because an unrelated worker becomes available. Admin should see reasons, progress, offer status and next actions.
5. Add an isolated admin simulator that runs actual dispatch logic against an in-memory store. It must never create real bookings, send pushes or move money. Distinguish simulation from installed-device notification delivery.
6. Existing deployment is test payments. Do not claim real push delivery or production release without evidence. Background processing requires a running scheduler; surface heartbeat rather than promise that sleeping hosting is always on.

Approaches: manual assignment preserves control but increases work and delays; automatic internal-first routing with exception handling meets the scaling request and was recommended/approved. Broadcast to every partner is rejected in favour of bounded groups and bounded retries.
