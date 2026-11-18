# ANVIRA six-service marketplace

The November 2026 redesign replaces the earlier marketing-only Welcome screen with a responsive public services website. It focuses on home cleaning, car cleaning, AC repair, RO filter service, plumbing and electrician. The forest, ivory and gold visual identity includes photographic categories, search, service spotlights, published service cards, descriptive subcategories and a responsive website layout. Native customer Home and service/package screens use bundled photographs in the same palette.

The website provides service information, inline scope details and enquiry links. `/staff` is the only sign-in entry and accepts approved Owner and Customer Care email accounts. Customer OTP, bookings and accounts belong to the iPhone/Android app. Website builds set `EXPO_PUBLIC_WEBSITE_STAFF_ONLY=true`, protect customer routes in Expo Router and redirect customer URLs at the deployment boundary. See [website/mobile boundary](WEBSITE-MOBILE-BOUNDARY.md).

Prices and bookable packages come from the API. Authored subcategory descriptions are enquiry information; they do not create unapproved products or prices. Quote-only services never display retained internal placeholder/package amounts as a tariff. Campaign banners link to the relevant category without invented ratings, discounts, completed-job counts or provider availability.

Contact links use `/api/public.supportPhone` when configured, otherwise a reviewable email draft to `anviraservicesllp@gmail.com`. PIN checks use published catalogue coverage. No enquiry message is sent automatically. The client About Us publication workflow below remains available.

## Media

For the November 2026 redesign, see [current service imagery provenance](SERVICE-IMAGERY.md). Generated AC and plumbing photos replace the historical stock sources below; RO, kitchen and bathroom photos are also generated representative imagery.

Service photographs are locally hosted representative stock imagery, not ANVIRA staff or completed client jobs. Sources are Unsplash (https://unsplash.com/license):
- Car: https://unsplash.com/photos/Vy2kaSObSOk (photo-1594611372993-761f31b97dae)
- Laundry: photo-1517677208171-0bc6725a3e60
- Cleaning: photo-1581578731548-c64695cc6952
- Workplace: photo-1497366754035-f200968a6e72
- Beauty: photo-1487412947147-5cebf100ffc2
- Sofa: photo-1555041469-a586c61ea9bc
- Electrical: photo-1621905251189-08b45d6a269e
- Plumbing: photo-1607472586893-edb57bdc0e39

AC photo: https://www.pexels.com/photo/technician-fixing-an-aircon-5463582/
Car-care illustrative film: Tima Miroshnichenko, https://www.pexels.com/video/a-person-car-washing-6872065/ (https://www.pexels.com/license/).

The redesigned marketplace uses still photography. Reduced-motion preference disables decorative transitions. Website service details expand inline and lead to an enquiry. Native app service details use their own routes and booking/quote actions.

## Domain connection

The client domain is anviraservices.com. Connect it to the existing Vercel project and apply the DNS records Vercel provides; preserve email/MX/TXT records. Domain access and DNS ownership verification must be completed in the client's signed-in account. No passwords or registrar credentials belong in this repository.

## Owner-managed About Us

Public page: `/about`. The Owner opens **Roles & settings → About Us website page** in the staff portal. Add the title, short introduction and company story; mission, values and service areas are optional. **Save About Us draft** keeps changes private. **Preview draft** displays the entered text inside the editor. **Publish About Us** makes that version public immediately. Later draft edits do not alter the published version. **Unpublish About Us** removes the company story from public view and retains the draft. Until publication, visitors see a general services introduction without invented company history. Content is plain text, stored in Firestore through the authenticated backend; Customer Care and other roles cannot edit it. Concurrent edits are rejected with a reload instruction.
