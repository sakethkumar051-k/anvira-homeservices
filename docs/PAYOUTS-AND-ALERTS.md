# Partner payouts and booking alerts

The Owner can pause payouts or choose daily/weekly processing in IST, minimum withdrawal, reserve, per-partner maximum, batch limit and mandatory approval. Eligible partners require approved profiles and verified banks. Each period has deterministic payout IDs; funds are held once and failed transfers require reconciliation before release.

Professionals save a bank account, consent to verification and check its result. Only masked account details are retained. A successful ₹1 validation must match the saved fund account and holder name. Name mismatches require Owner review; uncertain provider responses cannot be retried blindly. Bank changes are blocked while funds are held and start a 24-hour payout cooling period by default.

## Demonstration

Demo mode simulates bank validation and transfers. Save a bank, use the labelled simulated verification, configure a schedule, run a sample cycle and approve queued payouts. These actions do not transfer money. Firebase mode never substitutes demo transfers.

## Real activation

Real bank validation requires approved RazorpayX live access; Razorpay does not provide bank validation in test mode. Configure server-only RazorpayX keys, source account and signed webhook secret, approved network access, PAYOUTS_ENABLED=true and BANK_VERIFICATION_ENABLED=true. Keep these disabled until the business approves live activation. Existing payment environment must also be live. No credentials are included in this repository.

Free Render may sleep and cannot guarantee on-time daily/weekly jobs. Production needs an always-running worker or reliable authenticated scheduler, monitoring, reconciled provider webhooks, funded payout account and operational handling of failed or uncertain transfers. Eligibility previews are bounded to 500 professionals; larger deployments require pagination before launch.

## Alerts

The notification bell shows unread messages. Staff receive booking creation and payment alerts. Users enable and test sound explicitly; browser audio requires interaction and the website must remain open. Native notification permissions are required and device behavior must be verified in a development build. This is not a guarantee of background browser delivery.

## Publishing services

Sample drafts require explicit Owner approval of scope and pricing before publication. Publication exposes the catalogue entry; booking availability additionally depends on coverage, professionals, policies and payment configuration.
