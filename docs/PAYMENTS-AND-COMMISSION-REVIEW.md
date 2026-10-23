# ANVIRA payment and business model — client review

Status: Razorpay TEST environment only. Test transactions do not collect revenue or settle real money. Business rules below are proposed operating rules; final legal/tax text and production publication need the client's business details.

## Agreed model

ANVIRA sets the customer price and collects the booking payment. In-house professionals are salaried outside the partner wallet. Partner/part-time professionals earn the completed booking amount minus ANVIRA's commission. Owner controls the commission policy.

| Paid booking total after discounts | Platform commission | Example | Partner net |
| --- | ---: | ---: | ---: |
| Below ₹1,000 | 10% | ₹900 → ₹90 | ₹810 |
| ₹1,000–₹9,999 | 15% | ₹2,000 → ₹300 | ₹1,700 |
| ₹10,000–₹19,999 | 20% | ₹12,000 → ₹2,400 | ₹9,600 |
| ₹20,000 and above | 25% | ₹24,000 → ₹6,000 | ₹18,000 |

One bracket applies to the entire booking, not progressively. Commission rounds to the nearest whole rupee; partner net is the exact remainder. This creates a threshold effect: ₹9,999 pays a partner ₹8,499 while ₹10,000 pays ₹8,000. Do not split or understate bookings to avoid a bracket. If this is commercially undesirable, a progressive model is a separate decision.

The checkout stores a policy snapshot. Later Owner edits cannot change its rate or money amounts. In-house jobs do not create withdrawable partner credits. The current app does not separately account for tax, materials or tips: commission currently applies to the complete paid total after discounts. Do not promise a pre-tax/material-excluded commission base until those amounts are separately implemented.

## Proposed launch rules

- Collect payment for the confirmed scope before the job. Extra work needs a new approved quote and booking; professionals cannot change a paid total or demand an undocumented payment.
- Offer online payments only for the initial launch. Cash handling, collection reconciliation and partner cash deductions require separate workflows.
- ANVIRA bears gateway processing charges initially as a business cost; do not deduct an unshown fee from a refund or partner ledger. Commission is gross platform revenue, not profit: deduct gateway fees, refunds, support/rework, marketing and applicable taxes when assessing margin.
- Credit partner earnings once the professional completes the checklist and handover. Require Owner review for withdrawals. Proposed operating practice: batch cleared completed jobs weekly after a 48-hour complaint review and receipt of gateway settlement. **A 48-hour hold is not automatically enforced by the current wallet.** Do not promise automatic weekly bank transfers until payout credentials and scheduling are enabled and tested.
- Keep in-house salaries, employment deductions and payroll outside this booking commission ledger.
- Permit self-service cancellation at least two hours before the slot. Within two hours, route requests to support. For launch, use the existing full-refund approval flow rather than introducing cancellation penalties or partial refunds.
- If ANVIRA cannot fulfil a paid booking, offer a reschedule with customer agreement or a full refund. Never mark a refund paid until the provider confirms it. Refunds go back through the original payment, not to a supplied alternate bank/UPI account.
- Laundry cannot be self-cancelled after collection. Staff must record physical return of the items before cancelling through the return workflow. Lost/damaged property needs an incident record and an approved compensation policy; no fabricated delivery or automatic compensation promise.
- Treat photos, warranty and revisit eligibility as scope-specific. Customer-entered warranty dates do not create an ANVIRA guarantee. Service-quality complaints use booking-linked support and Owner review.
- Retain payment/booking/commission references for reconciliation; restrict staff access and never request card numbers, CVV or UPI PIN through support.
- Display the final payable amount before checkout. Confirm GST registration, GSTIN, service classification, invoice issuer and tax treatment with the company's accountant before issuing tax invoices. Company registration alone is not GST registration. Existing booking receipts are not GST invoices.

## Test collection plan

1. Keep server RAZORPAY_ENVIRONMENT=test and test-prefixed keys. Never put a key secret or webhook signing secret in Expo/public frontend variables.
2. Create the Razorpay order on the server from its booking amount in paisa; use the stored order id for signature verification and fetch the payment from Razorpay before crediting a booking.
3. Exercise success, failure, dismissed checkout, pending capture, duplicate callback/webhook, wrong amount/currency/order, late capture after reservation expiry, cancellation and refund. Distinguish mocked regression tests from an actual provider sandbox transaction.
4. Use a client review APK built against the HTTPS staging API, with a visible preview notice. Confirm Firebase configuration, Android package, signing SHA fingerprints, email/Google login, checkout browser return and payment refresh on a physical phone.
5. Configure the actual test webhook endpoint and event subscription in the Razorpay dashboard. A configured webhook secret alone does not prove delivery. Verify dashboard delivery, processing and retries against the hosted API.
6. Reconcile test order, captured payment, booking total, ledger credit/commission, refund and job status. Test partner withdrawals independently; ordinary Checkout does not enable RazorpayX or Route.
7. After client acceptance: complete merchant activation/KYC and bank settlement verification, approve real catalog/policies, switch the server to live keys and matching webhook secret, then perform an approved small live transaction/refund. App Store and Play Store publication follows device acceptance and enrollment.

## Official references

- Razorpay integration and testing: https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/
- Settlements require an activated/KYC-approved account and captured payment; actual timing is account dependent: https://razorpay.com/docs/payments/settlements/
- Normal refund provider guidance: https://razorpay.com/docs/payments/refunds/
- Route is a separate linked-account/split-payment product with its own eligibility: https://razorpay.com/docs/payments/route/
- APK internal distribution: https://docs.expo.dev/build-reference/apk/
