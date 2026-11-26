// Production legal content for the ANVIRA app and website.
// Business details live in one place so the owner can update them without
// touching the policy text. Leave a field empty to hide it.
export const BUSINESS = {
  name: "ANVIRA Services",
  email: "anviraservicesllp@gmail.com",
  phone: "+91 79893 65699",
  phoneHref: "tel:+917989365699",
  /** Registered business address. Fill in before store submission. */
  address: "",
  /** Grievance officer name under India's IT Rules, 2021. */
  grievanceOfficer: "",
  effectiveDate: "26 November 2026",
};

export type LegalSection = { title: string; text: string[] };

export const privacyPolicy: LegalSection[] = [
  {
    title: "Who we are",
    text: [
      `${BUSINESS.name} ("ANVIRA", "we", "us") operates the ANVIRA mobile app and website, which let customers book home services such as cleaning, car care, AC service, water purifier service, plumbing and electrical work, and let approved professionals receive and complete those jobs.`,
      "This policy explains what personal information we collect, why we use it, who we share it with, how long we keep it, and the choices you have.",
    ],
  },
  {
    title: "Information we collect",
    text: [
      "Account information: your name, mobile number, and the email address or Apple/Google account identifier you use to sign in.",
      "Booking information: service addresses and PIN codes, the services and options you choose, visit times, instructions you add, booking status and history, ratings and reviews.",
      "Payment information: payments are processed by Razorpay. We receive payment, order and refund references and the amount paid. We do not receive or store your full card, UPI PIN or bank login details.",
      "Messages and support: messages you send in a booking conversation and support requests you raise.",
      "Professionals only: profile photo, skills, service areas, availability, identity and skill documents you upload for verification, and bank account details for payouts.",
      "Device information: a push notification token and a device identifier used to deliver notifications and keep your sign-in secure. We do not collect your precise location in the background.",
    ],
  },
  {
    title: "How we use your information",
    text: [
      "To create and secure your account, and to verify your mobile number.",
      "To take bookings, assign a professional, send booking updates, process payments and refunds, and provide customer support.",
      "To verify professionals, pay their earnings, and keep the marketplace safe.",
      "To meet legal, tax and accounting obligations and to prevent fraud or misuse.",
      "We do not sell your personal information, do not show third-party advertising, and do not track you across other companies' apps or websites.",
    ],
  },
  {
    title: "Who we share it with",
    text: [
      "The professional assigned to your booking sees your name, the service address and the booking details needed to do the job. Customers see the assigned professional's name, photo, rating and languages.",
      "Service providers that run the app for us: Google Firebase (sign-in, database and file storage), Razorpay (payments, refunds and payouts), Expo (push notification delivery), Apple and Google (sign-in, when you choose them), and our hosting providers. They process data only to provide their services to us.",
      "Authorities, when the law requires it or to protect the rights and safety of our customers, professionals or the public.",
    ],
  },
  {
    title: "How long we keep it",
    text: [
      "Booking conversation messages are deleted 30 days after they are sent.",
      "Account, booking and payment records are kept while your account is active and afterwards for as long as needed for accounting, tax, dispute and legal purposes.",
      "When you delete your account, we delete or anonymise your personal information, except records we must keep by law (for example, payment and invoice records).",
    ],
  },
  {
    title: "Your choices and rights",
    text: [
      "You can view and update your profile and saved addresses in the app.",
      "You can delete your account at any time in the app: Profile → Account settings → Delete my account. You can also request deletion at anviraservices.com/delete-account or by emailing us.",
      "You can turn off push notifications in your phone's settings. Booking updates remain available in the app.",
      "To access or correct your information, or for any privacy question, contact us using the details below.",
    ],
  },
  {
    title: "Security",
    text: [
      "We use encrypted connections, access controls based on staff roles, and audit records for sensitive actions. No system is perfectly secure, so please keep your phone and sign-in details safe and never share a one-time code.",
    ],
  },
  {
    title: "Children",
    text: [
      "The app is intended for adults aged 18 and over. We do not knowingly collect information from children.",
    ],
  },
  {
    title: "Changes to this policy",
    text: [
      "We will update this page when our practices change and show the new effective date. Significant changes will also be announced in the app.",
    ],
  },
];

export const termsOfService: LegalSection[] = [
  {
    title: "About these terms",
    text: [
      `These terms apply when you use the ANVIRA app or website operated by ${BUSINESS.name}. By creating an account or making a booking you agree to them. You must be 18 or older to book.`,
    ],
  },
  {
    title: "Bookings",
    text: [
      "Each service page describes what is included and not included. Prices are shown in Indian rupees before you pay, and the total at checkout is the amount charged.",
      "A booking is reserved for 15 minutes while you pay. If payment is not completed in that time, the slot is released.",
      "Some services, such as repairs that need parts or monthly plans, are priced by quote. Work outside the booked scope needs your approval before it starts.",
      "Please make sure someone is available at the address at the booked time and that the professional can safely access the work area.",
    ],
  },
  {
    title: "Rescheduling and cancellation",
    text: [
      "You can reschedule or cancel in the app up to 2 hours before the visit, unless a different cut-off is shown on your booking. Inside that window, contact Support.",
      "If you cancel a paid booking within the allowed time, or we cannot provide the service, you receive a full refund to your original payment method. Refunds usually reach you within 5–7 working days after approval, depending on your bank.",
    ],
  },
  {
    title: "Service quality",
    text: [
      "If you are not satisfied with a completed service, raise it from your booking or through Support within 7 days. We review each concern and may arrange a revisit, a partial or full refund, or another fair resolution.",
    ],
  },
  {
    title: "Professionals",
    text: [
      "Professionals on ANVIRA are either ANVIRA team members or independent partners verified by us. Partners must keep their documents, skills and availability accurate, complete accepted jobs professionally, and follow these terms and any partner agreement.",
    ],
  },
  {
    title: "Acceptable use",
    text: [
      "Do not misuse the app, give false information, harass professionals or customers, or try to arrange payment outside the app for a job booked through ANVIRA. We may suspend accounts that break these rules.",
    ],
  },
  {
    title: "Liability",
    text: [
      "We take reasonable care in selecting and verifying professionals. To the extent permitted by law, our liability for any booking is limited to the amount paid for that booking. Nothing in these terms limits rights you have under Indian consumer protection law.",
    ],
  },
  {
    title: "Governing law and complaints",
    text: [
      "These terms are governed by the laws of India. Please contact Support first so we can try to resolve any issue. Complaints are acknowledged within 48 hours and resolved within 30 days.",
    ],
  },
];
