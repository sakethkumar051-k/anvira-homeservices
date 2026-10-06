# ANVIRA service and professional experience update — 6 October 2026

The customer, professional and Owner workspaces share the same Expo application and API. This update adds connected business capabilities, rather than a numerical claim that the app has become “50% larger.”

## Support and Owner sign-in

Support requests now accept short messages of two or more characters. Empty-message validation, successful sends and failed sends appear next to the form; replies also show confirmation or errors. Request and reply retry keys prevent duplicate conversations after an interrupted connection. Booking/request access remains checked on the server.

The Firebase Owner identity `anviraservicesllp@gmail.com` exists, is enabled, has the password provider and the Owner claim. A read-only check found Firestore rejecting reads with code 8 (quota exhausted); credential expiry and permission denial were not reported. The current Firestore Owner role record and full dashboard could not be re-read while this quota error persisted. The app now returns an explicit database-quota message instead of “Something went wrong.” A duplicate role lookup was removed from each authenticated request, reducing Firestore reads without caching permission decisions.

This does **not** verify the user's password or restore live database access. The Firebase project must regain quota, or the account holder must change billing/limits. The user deferred billing; phone authentication has since been removed. Firebase's [quota documentation](https://firebase.google.com/docs/firestore/quotas) explains free quotas and the daily reset; no billing change was performed.

## Added capabilities

| Workspace | Capability and behaviour |
|---|---|
| Owner | Package builder: up to six named packages with descriptions, complete prices, durations and individual inclusions |
| Owner | Choice groups: up to six groups, required or optional, each with up to eight choices and price/time additions |
| Owner | Preparation instructions shown before checkout |
| Owner | Configurable warranty/revisit terms; no invented business guarantee |
| Owner | Expandable customer FAQs |
| Owner | Service-specific completion tasks required from the professional |
| Owner | Service preview with scope and care information |
| Owner | Duplicate an existing service as a hidden draft |
| Owner | Publish/hide controls; booked scope, price and duration remain snapshots |
| Owner | Field-specific validation errors beside the save action; reopening the editor loads current service details |
| Customer | Package and option selection with required-choice validation |
| Customer | Extra price and duration shown before booking; server-calculated quote and payment total |
| Customer | Access instructions and other notes sent with the booking |
| Customer | Preparation, FAQs and warranty terms available before checkout |
| Customer | Assigned professional's photo, biography and languages |
| Customer | Arrival progress and notification, professional handover notes and itemised receipt choices |
| Professional | Photo selection, square crop, JPEG compression, replacement and removal |
| Professional | Public biography and spoken-language editing without changing approval or skills |
| Professional | Booked package/scope/options and customer instructions in the job details |
| Professional | Arrival recording, with assigned-job access and live appointment-time checks |
| Professional | Custom completion checklist alongside standard handover tasks |
| Professional | Handover/care notes retained for the customer |
| Professional | Paginated job history with search within the displayed page, including cancellations |
| All | Visible support feedback, safe retries and a meaningful database quota error |

Pricing, duration and valid options use one shared server helper for checkout, quotes and available slots. Client-supplied prices are ignored. The total duration is limited to four hours, with thirty-minute increments, matching the existing capacity-lock system. Invalid or unknown choices are rejected. Existing bookings can still query rescheduling slots after a service is hidden.

## Profile photo storage

The app uses the SDK 57 [image picker](https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/) and [image manipulator](https://docs.expo.dev/versions/v57.0.0/sdk/imagemanipulator/). Gallery selection is supported on web, iOS and Android; camera and microphone permissions are disabled. The image is cropped and re-encoded as a 256×256 JPEG before sending. The API checks framing/dimensions and caps the thumbnail at 32 KB.

A separate private `avatars` document stores the thumbnail; app state contains only its update timestamp. Authenticated users can read photos of approved professionals; pending photos are limited to that professional and staff. Self-service writes cannot change another person's photo. Removal/account deletion removes the avatar. This works without enabling Firebase Storage, but real Firebase reads/writes still require available Firestore quota. Identity/certification documents are never used as public profile photos.

A fresh native development/release build is required for the newly added modules. Successful bundle exports do not verify gallery permissions or rendering on a physical device.

## Review

Start the isolated sample with `./RUN-DEMO.command`. Open [professional sample](http://localhost:4001/?sample=professional); it signs into Ravi Kumar's demo workspace. Photo controls are under **Profile → Professional profile & schedule**. Sample sign-in is only compiled into the demo build. The live Firebase app remains [localhost:4000](http://localhost:4000/).

Home-service package, scope and extra-option patterns were informed by [Urban Company's official cleaning page](https://www.urbancompany.com/hyderabad-professional-home-cleaning). ANVIRA retains its own interface, wording and business-configured terms.

## Verification

`npm run check`: lint, typecheck and 51 API tests pass. `npm run test:ui` exercises the existing 21 journeys. `npm run test:ui:features` exercises eight additional journeys for the expanded service builder, custom checkout, professional completion/history, photos, short support messages, draft duplication/publishing and 360-pixel mobile layout. Final results are in `evidence/feature-check-results.json`, `evidence/ui-results.json` and `evidence/new-feature-ui-results.json`.

Expo Doctor: 21/21 checks. Web, iOS and Android bundle exports succeed. Automated checks use an isolated demo database or fake identity/provider fixtures, and do not write sample data to the live Firebase project. Payment-provider credentials, real-device checks and production launch gates remain pending.

Later auth update: Google/email providers are enabled and the Firestore connectivity check succeeds again. See [AUTH-UPDATE.md](AUTH-UPDATE.md).
