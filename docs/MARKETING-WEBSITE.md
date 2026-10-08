# ANVIRA public marketing website

The green, cream and gold theme is preserved. The web Welcome component is separate from the native screen; Framer Motion stays in the web bundle. Customer and professional account routes remain excluded from the published website. Owner and Customer Care access remains at /staff with existing email/password authentication.

The client's ₹500/month car-cleaning starting price is enquiry copy, not a published booking tariff. Included visits and exact scope must be confirmed before booking. Laundry and dry cleaning emphasise pickup and delivery. Beauty and commercial cleaning are marketing enquiry categories; no false provider inventory or automatic service publication was created.

Contact information comes from /api/public.supportPhone, with EXPO_PUBLIC_WHATSAPP_NUMBER as a fallback (international digits, without +). The client-approved fallback is +91 79893 65699. If no valid number is configured, the contact form opens a reviewable email draft to anviraservicesllp@gmail.com and the floating contact button scrolls to the form. No message is sent automatically or represented as delivered.

The temporary WhatsApp attachment path expired. The supplied black AS logo was faithfully prepared as a PNG from the conversation image; use the original production PNG if supplied later. Screen logos, app icon assets and website favicon use the new mark. Existing installed native apps require a new build to update launcher icons.

## Media

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

Video only loads on request. Spoken announcements are opt-in and depend on browser speech/available voices. Reduced-motion preference disables decorative motion. The service detail dialog supports Escape, keyboard focus containment and focus restoration.

## Domain connection

The client domain is anviraservices.com. Connect it to the existing Vercel project and apply the DNS records Vercel provides; preserve email/MX/TXT records. Domain access and DNS ownership verification must be completed in the client's signed-in account. No passwords or registrar credentials belong in this repository.

## Owner-managed About Us

Public page: `/about`. The Owner opens **Roles & settings → About Us website page** in the staff portal. Add the title, short introduction and company story; mission, values and service areas are optional. **Save About Us draft** keeps changes private. **Preview draft** displays the entered text inside the editor. **Publish About Us** makes that version public immediately. Later draft edits do not alter the published version. **Unpublish About Us** removes the company story from public view and retains the draft. Until publication, visitors see a general services introduction without invented company history. Content is plain text, stored in Firestore through the authenticated backend; Customer Care and other roles cannot edit it. Concurrent edits are rejected with a reload instruction.
