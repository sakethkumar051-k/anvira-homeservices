# Office-controlled ANVIRA fulfilment

## Intent and authority

The client runs an office-controlled home-services company. Customers book in the mobile app; the office receives paid orders, assigns salaried internal workers, dispatches them and records their progress. Internal workers need no app account. Approved external partners use the professional app only when the Owner permits external fulfilment and internal capacity is unavailable. The first currently eligible partner to accept an unexpired offer wins atomically.

The user explicitly asked to research, make implementation decisions and finish the work in this run. This document records the resulting decisions for review; it does not introduce a further approval pause for reversible implementation. Real charges, account enrollment agreements and paid services remain outside this run.

## Approach

Extend the existing transactional booking, capacity-lock, payment and commission system rather than replacing it. Keep `owner` and `care` permission IDs; display Admin / Owner and Customer Associate. Reuse `/staff` on mobile with a distinct sign-in entry. Preserve customer/professional authentication and the visual system.

Alternatives considered: requiring internal workers to use professional accounts conflicts with the client's operations; unrestricted partner auto-assignment bypasses Owner control; a separate dispatcher service would duplicate locks and payment state. A dispatch record attached to existing bookings plus a private partner-offer inbox is the smallest coherent approach.

## Business controls

- Company `dispatchMode`: `office_first` or legacy `automatic`. Existing records without a mode retain legacy behavior until Owner enables office mode; new office review fixtures explicitly enable it. The website makes activation and current mode obvious.
- `externalPartnersEnabled` defaults false. Owner alone edits it. `partnerOfferSeconds` defaults 120, bounded 60–300.
- A service can disable external fulfilment with `partnerFulfillmentAllowed`; missing means allowed subject to the company gate. Services, pricing, policies and commissions remain Owner website controls.
- Existing whole-booking commission slabs and payment-environment snapshots remain unchanged. Internal work creates no partner wallet earnings. Test data never enables real payments or real payouts.

## Office workflow

Internal workers stay in `professionals` for capacity/reporting, with `type: In-house`, `accountless: true`, a generated ID, active/available flags, name, office-only contact, service skills, PINs and schedule. Creating one provisions no Firebase/user identity. Owner manages the roster; Customer Associates can update operational availability.

Checkout still holds one actual eligible worker's time segments for 15 minutes. Paid office bookings extend that single hold and enter the office queue, without asking an internal worker to accept in an app. Staff assign an eligible internal worker, mark dispatched, arrival, start and completion. Existing checklist, laundry ordering, payment and refund guards apply. Staff actors/timestamps are audited. Replacement moves locks atomically and failed changes roll back.

New bookings carry `dispatch: {version:1,state,revision,roundId?,expiresAt?,assignedBy?,dispatchedBy?,dispatchedAt?}`. States include `awaiting_staff`, `assigned`, `dispatched`, `offering`, `claimed`, `attention`. Existing lifecycle statuses remain authoritative. Staff assignment confirms an internal job; professional self-service remains available for legacy assigned jobs for backward compatibility. Accountless records can never authenticate.

Office response deadlines and expired partner rounds escalate to office attention. They do not silently invoke legacy auto-reassignment/refund behavior. Staff can use the existing cancellation/refund process; no automatic financial policy is invented. Offer acceptance checks expiry synchronously even if the worker has not run.

## Partner offers and privacy

Automatic fallback opens only for paid office bookings with no eligible internal capacity, company permission and service permission. Staff can retry a round when these conditions hold. Every send and accept rechecks permission and eligibility. If internal capacity becomes available, staff can assign internally, invalidating the round.

`dispatchOffers` records identify recipient, booking, current round and expiry. A partner inbox returns only offer ID, service/scope, slot, duration, area PIN, expiry, gross, commission and expected net. It excludes customer name/contact, full address, instructions, free-form answers and messages. Existing full-booking authorization is not widened.

Accept runs in one transaction: check active approved Partner identity/profile, current round, company/service permission, paid/non-refunding booking, expiry, skill, PIN, availability/schedule and all capacity segments; move the one hold, snapshot the winner/type/rate and confirm. Winner retry is idempotent. Losers and stale recipients receive a recoverable conflict. Cancel, reschedule, reassignment, permission revocation and expired/replaced rounds prevent later claims.

API contract: staff `POST /api/inhouse-workers`, `PATCH /api/inhouse-workers/:id`, `PATCH /api/inhouse-workers/:id/availability`; professional `GET /api/partner-offers` -> `{offers:[...]}`, `POST /api/partner-offers/:id/accept` -> booking, and `POST /api/partner-offers/:id/decline` -> `{ok:true}`. Staff booking actions include existing `assign`, new `dispatch` and `offer_partners`; staff can `arrive`, `start`, `complete` only for internal assignments. Offer DTO uses `id`, `bookingId`, `roundId`, `serviceName`, `scope`, `slot`, `duration`, `pin`, `expiresAt`, `gross`, `commission`, `net`.

## User experience

Customer, Professional and Staff sign-in entry points are distinct; server roles determine actual access. Staff see usable phone-sized order cards. Owner setup explains services, coverage, workers and external fallback. A guided service editor puts required basics first and advanced options behind disclosure, with clear draft/publish status and local validation/errors. Customer booking copy describes office dispatch, assigned team and next steps without asking internal workers to accept. The public website's enquiry categories remain distinct from bookable services/prices.

Partners see current offers with a countdown, scope and expected earnings, explicit Accept/Decline, retry feedback and no expired action. After a successful claim the normal job screen exposes assigned customer information. Availability and verification requirements stay clear.

## Alerts and deployment constraints

Use Expo SDK 57 normal visible notifications with a short distinctive sound on Android channel `partner-offers-v1`, optional sound permission and safe foreground banners. No full-screen calling, VoIP, critical-alert or background-audio workaround. Deduplicate local/remote cues, route offer taps to `/jobs` and suppress stale offers/outbox retries. Outbox data includes `kind: partner_offer`, `offerId`, `roundId`, `expiresAt`, with a minimal body and no customer information. Push transport TTL/expiration must respect offer expiry. Prompt outbox draining follows committed mutations, with background recovery.

Render Free can sleep and cannot guarantee urgent dispatch or background delivery. Actual FCM/APNs credentials and physical Android/iPhone notification tests remain release gates; provider tickets alone do not prove sound/display. Razorpay KYC/refund/webhook verification, durable private uploads, backup restoration, dependency triage, approved real data/policies and store enrollment remain explicit external or verification gates.

## Validation

Pin role authorization, in-house no-account lifecycle and zero earnings; winner races and overlapping claims; stale/expired/revoked/rescheduled/cancelled/refunding offers; capacity-hold replacement and release; private DTOs; legacy booking compatibility; test/live isolation; staff mobile navigation and service validation. Run full Node tests, lint/typecheck, web/native exports, browser flow and Firestore concurrency/index checks. Produce a new Android review build only after source verification and distinguish emulator success from physical acceptance.
