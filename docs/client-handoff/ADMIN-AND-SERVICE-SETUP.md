# ANVIRA: Owner setup and staff access

The same service controls apply to every category. Home cleaning is one example, not a special pricing system.

## Create a Customer Associate login

1. Sign in at https://anviraservices.com/staff using the Owner account.
2. On Overview, find **Owner setup guide → Create Customer Associate account**. It opens Staff access first. You can also open **Roles & settings**.
3. Enter the employee's name, an accessible email address not already used by another ANVIRA account, an app password and its confirmation.
4. Select **Create staff account**. This creates an ANVIRA login; it does not create a Gmail/company email inbox.
5. Share the staff portal URL and email privately with that employee. Share the password through your trusted private channel. Do not publish it in a document or group.
6. The employee selects **Staff** in the mobile app or visits the staff portal, signs in and sees Customer Associate operations. They can use **Reset password** with their accessible inbox.
7. Disable access from Staff access when that employee leaves. Salaried field workers need only roster records, not these login accounts.

## Configure any service safely

1. Open **Services → Create a service** (or **Edit service details**).
2. Set a clear name and category, description, what one booking covers, included work and exclusions.
3. Choose how customers book:
   - **Book at a published price** for work whose scope and price you can define in advance.
   - **Request a tailored quote** when the office needs to assess size, quantity, condition or custom work before setting the total. The placeholder catalog price is not offered to customers in this mode.
4. Set the standard price and duration only for its exact stated scope. It must never suggest unlimited work.
5. Add packages with complete prices, duration, included work and exclusions. Enable **Require a package before booking** whenever the standard/base scope must not be sold. This removes the cheap Standard option and the server also rejects attempts to bypass the requirement.
6. Use **Choices** for required or optional selections that add price/time. For example, vehicle size, appliance type, laundry bundle or condition. Choices add to the selected package/standard price; package prices replace the standard base price.
7. Add optional extras, customer questions, preparation guidance, completion tasks and only warranty terms your company can honour. Required customer answers are checked before a booking or quote request.
8. Preview the service. Check every package and required choice. Save drafts while reviewing; publish only actual client-approved prices and scope.
9. Link workers with the appropriate service skill and service PIN codes. Confirm their schedule and availability before taking bookings.

Examples of configuration dimensions (the client supplies actual rates and scope):

| Service | Possible packages/required choices | Useful limits to explain |
| --- | --- | --- |
| Vehicle care | Vehicle class, wash/detailing package, condition | One vehicle, covered surfaces, interior/engine exclusions |
| Appliance service | Appliance type, number-of-units package, inspection vs service | Diagnosis, labour and parts policy |
| Laundry | Garment/load bundle, care type, pickup option | Exact included quantity, excluded fabrics, additional items |
| Home cleaning | Home-size package, condition, selected rooms | Area/room/bathroom limits, included tasks, exclusions |
| Beauty | Treatment package, included steps, optional extras | Duration, products, preparation and suitability |
| Repairs/custom projects | Published inspection or tailored quote | Inspection scope; approved repair work/materials separately |

These are configuration examples, not approved live offers, per-kilogram metering, subscriptions or automatic recurring charges. Instant bookings currently support 30–240 minutes and a maximum configured total of ₹1,00,000. Unusual/multi-visit work needs an explicitly agreed operating process rather than an underspecified cheap package.

## What the customer sees

Customers can browse categories, search service/package names and sort by starting price. A required-package service cannot be booked at its unused base price. The customer sees the chosen package, required choices, included work, exclusions and the final server-validated total. Quote-only services request an estimate before payment. Approved quote answers and booked scope are saved so later catalog edits do not rewrite an existing order.

Use SAMPLE data and Razorpay Test Mode until client acceptance and the production checklist are complete. A service being published does not complete KYC, store review, physical push verification or hosting readiness.
