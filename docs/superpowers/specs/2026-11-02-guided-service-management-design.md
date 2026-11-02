# Guided management and safe service selection

The user's clarification applies to every service, not just cleaning. Preserve ANVIRA's existing visual design, free review hosting and Razorpay test mode. They have delegated implementation choices and repeatedly requested continued execution; proceed without a redundant design approval pause.

Existing capabilities already include packages, priced required option groups, add-ons, questions and scope, but they are hidden under advanced editing. The unsafe gap is that a customer can always choose the cheap standard/base service even when a package is necessary.

Approach: extend the existing generic service model and expose its controls prominently. Do not introduce category-specific hardcoded pricing or invent client rates. Templates, if provided, must be drafts/example scaffolding with explicit price review. A separate bespoke configurator per category would duplicate logic and make Owner management harder.

Fields: `bookingMode` instant/quote (default instant), `packageRequired` boolean (default false), `priceUnit` optional short plain description of what one base booking covers. Each package may have exclusions. Selected inclusions and exclusions are frozen into bookings. Backend rejects missing required packages and direct checkout/quotes/availability of quote-only services; an explicitly accepted tailored quote remains bookable through the existing server-controlled quote workflow. Price is always computed server-side from published choices; no client totals are trusted.

Owner: clear numbered setup guidance and direct links for services, coverage/team, staff access and dispatch. Explain Customer Associate account creation and credential sharing/reset without emailing passwords. Service editor exposes pricing mode, scope, packages/required choices/add-ons/questions without requiring technical knowledge; advanced area retains secondary translation/order controls. Show customer-facing preview and inline save errors. Existing editing capability and draft/publish workflow preserved.

Customer: category chips, search and understandable price sorting in the app; cards show starting price only when valid or Request quote. Service details and checkout explain unit, package scope/exclusions and required choices before payment. Required package has no Standard escape hatch. Quote-only detail/checkout lead to tailored quote requests. No new customer website authentication; public website remains enquiry/staff oriented as previously requested.

Landing: reproduce failed anchors/buttons; fix actual scroll/router/modal behavior with accessible real links/actions and retained reduced-motion support. Keep service enquiry modals meaningful; do not redirect public users into blocked customer web routes.

Validation: backend schema/selection/booking snapshot and quote-flow tests; actual landing anchor/modal/enquiry browser checks; customer category and required-package/quote-only browser story; Owner service/staff guidance checks; full lint/typecheck/Node tests and exports. Independent review before release. Current APK 4 remains a previous review artifact until the new customer UI receives a fresh build.
