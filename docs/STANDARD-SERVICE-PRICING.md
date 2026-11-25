# ANVIRA standard services — starter rate card

User requested normal direct bookings and editable starter prices on 24 November 2026. These ANVIRA prices are starting configuration for the connected **test-payment** application. They are editable by Owner under Services → Pricing → Edit service option prices. Business launch approval remains separate. The customer sees the actual payable amount for the chosen task, and inspection/labour-only exclusions are stated before booking.

## Published references checked 24 November 2026

Urban Company prices vary with city, option and time. Reference pages are linked directly. Their ratings, warranty, arrival estimates and brand-specific promises are not reproduced in ANVIRA.

| Category | ANVIRA starter choices / INR | Basis |
| --- | --- | --- |
| Home cleaning | 1 bathroom 529; 2 bathrooms 978; kitchen 999; 3-seat fabric sofa 1,197; furnished 1-bedroom home 3,499; empty 1-bedroom home 3,199 | [Bathroom](https://www.urbancompany.com/hyderabad-professional-bathroom-cleaning), [kitchen](https://www.urbancompany.com/hyderabad-professional-kitchen-cleaning), [full home](https://www.urbancompany.com/hyderabad-professional-home-cleaning). Sofa is an ANVIRA derivation of 3 × the published [399 starting seat price](https://www.urbancompany.com/hyderabad), rather than a verified UC three-seat offer. Apartment scope is explicitly limited to 600 sq ft in ANVIRA; durations rounded to supported 30-minute intervals. |
| AC | Split cleaning 599; 2 split ACs 1,098; check-up 299; window cleaning 549; split installation 1,099; removal 699 | [Hyderabad AC menu](https://www.urbancompany.com/hyderabad-appliance-repair) and [published window-cleaning rate](https://www.urbancompany.com/hyderabad-ac-service-repair-hyder-nagar). New copper piping, gas, brackets and repairs are excluded unless separately approved. |
| RO | Fault check-up 299; filter/flow check 299; customer-supplied filter fitting 299; wall installation 449; under-counter installation 649; removal 399 | [RO service menu](https://www.urbancompany.com/hyderabad-ro-repair). Customer-supplied filter fitting is an ANVIRA labour-only proposal using the check-up rate as a starting point. UC's complete replacement-kit offer is not adopted; brand compatibility and parts cannot be promised at an inspection price. |
| Plumbing | Tap repair 129; tap fitting 129; flush adjustment/repair 199; accessible basin blockage 199; shower-head fitting 129; inspection only 49 | [Plumber menu](https://www.urbancompany.com/hyderabad-plumbers) and [consultation starting price](https://www.urbancompany.com/hyderabad). Each ANVIRA task has a bounded scope; fixtures and other parts cost extra. |
| Electrician | Switch/socket replacement 79; standard ceiling-fan fitting 99; fan inspection/adjustment 149; tube/LED fitting 99; MCB fitting 149; inspection only 49 | [Electrician menu](https://www.urbancompany.com/hyderabad-electricians) and [consultation starting price](https://www.urbancompany.com/hyderabad). Materials, rewinding, concealed wiring and major repairs excluded. |
| One-time car cleaning | Small car exterior 499; small car inside/out 899; SUV exterior 699; SUV inside/out 1,099 | Existing ANVIRA car-cleaning configuration; SUV rates derive from the existing 200 size increment. These are internal ANVIRA proposals, not verified Urban Company car-wash tariffs. |

## Relevant extras

Cleaning: one fan 99; microwave 199 only with kitchen; a small balcony 549 with partial cleaning. No extras offered with the four-hour furnished-home package. AC: one more split AC 499 only with split-cleaning options. Plumbing: another tap 129 for known repair/fitting jobs; customer-supplied jet spray fitting 199 with flush work. Electrical: another switch/socket 79 with known jobs; supplied regulator fitting 89 only with fan work. Car: rubber mat deep clean 149. RO deliberately has no generic extras.

Extras have no default selections, describe a specific job, are filtered by chosen package and remain inside the existing four-hour service limit. No fake crossed-out prices, popularity badges, ratings or prechecked purchases are added.

## Booking and administration

A customer can tap Book on a named option, review useful extras, choose address/time and continue to payment. The selected option is carried to checkout; package selection is not repeated by default. The customer can still change it explicitly. For check-ups the fee covers inspection, not an undisclosed final repair. Bigger/unusual work retains the team-request path. Existing monthly Car Care remains monthly and team-confirmed; the new one-time car menu is a distinct service in the same category.

The migration targets only five existing normal-service records plus one new one-time car record and adds its skill to the two existing accountless sample workers. It leaves the monthly record, other services, customer/Auth records, bookings, refunds, policy and payment settings unchanged. It creates a private encrypted archive before applying an exact, reviewed before-state transaction. A template marker prevents a later rerun from resetting prices edited by Owner. The archive records absent/new record IDs as well as pre-update records; restoring an earlier state requires handling those newly created records explicitly.

## Application and verification

Applied to `anvira-services` in TEST payment mode after reviewing plan fingerprint `310caffdca97cb4d308ba07039bb58a66e83ae2736e9aad497b712dcc8b284a2`. A private encrypted pre-change archive was verified before the eight-record transaction. Hosted catalog HTTP 200 confirms six instant menus and the untouched monthly plan. All 34 standard options returned available times in a read-only cloud check; no cloud booking or payment was created by this verification. A subsequent migration dry run reports no remaining changes, so rerunning the tool does not reset admin prices.

Passed: `npm run check` (lint, typecheck, 364 unit tests); `npm run test:ui:standard` (34 option handoffs, six demo payments, no preselected extras, incompatible extras hidden, fresh Book vs saved draft/reload, required choices in displayed starting prices, admin price editing, original booking snapshot retained, all six Telugu menus at 320px); existing 21-scenario app suite; visit-cart retry/editing suite; Telugu customer/Owner monthly-plan suite; Expo iOS and Android exports. Screenshots and JSON results are under `evidence/standard-services/`.

The UI changes are available in the Expo Go source session. The connected catalog changes take effect through the API. This work does not rebuild the previously delivered APK or publish a store release.
