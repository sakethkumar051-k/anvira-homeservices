import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link } from "expo-router";
import { Card, T, c } from "./ui";

type Section = { title: string; text: string };
const terms: Section[] = [
  {
    title: "A test environment for client review",
    text: "These REVIEW-ONLY terms explain the client demonstration. They do not approve ANVIRA's production policies or launch offers. Every SAMPLE service, scope, price and professional is fictional. Test booking confirmations and availability do not arrange a real appointment. Do not expect a visit, collection, laundry processing, repair or delivery.",
  },
  {
    title: "Test payments, cancellations and earnings",
    text: "Use Razorpay test mode and its test payment details only. Do not make real payments or enter real card or bank details. The displayed INR amounts are fictional test values. Test refunds exercise the payment workflow; they are not real refunds. Professional earnings, commission, balances and payout screens are review calculations only. No real payment, settlement or payout is authorized by this review.",
  },
  {
    title: "Use sample information",
    text: "Use clearly fictional booking addresses and service instructions within the review PIN code 509216. Do not upload identity, bank, household or other sensitive documents. The fictional professional profiles are database fixtures, not verified real people. There is no real service guarantee, warranty, cancellation compensation or complaint resolution promise attached to these templates.",
  },
  {
    title: "Manual support and production approval",
    text: "For review questions, call +91 79893 65699 or email anviraservicesllp@gmail.com. No response time is promised during review. Before real orders open, the business must supply and approve its legal business details and address, contact information, service prices, terms, privacy information, cancellation and refund rules, and operational responsibilities. Publishing these review pages does not complete that approval.",
  },
];
const privacy: Section[] = [
  {
    title: "Review only; real sign-in data may still be used",
    text: "This page describes the client-review environment and is not ANVIRA's approved production privacy policy. SAMPLE service and professional records are fictional. A real sign-in can still create a real account record containing the identity information supplied by the sign-in provider, such as your name and email address. Use sample booking information and do not submit sensitive personal details.",
  },
  {
    title: "Information used during review",
    text: "The review app uses account records and information entered into booking, support and service workflows to display and test those workflows. Booking selections, sample addresses, instructions, payment references, status changes, messages and audit records may be stored. Firebase provides authentication and data storage. Razorpay test mode processes test payment requests and returns test transaction identifiers. Do not enter real card or bank details or upload personal documents for a review.",
  },
  {
    title: "Access, deletion and retention questions",
    text: "Authorized staff can access review information through the app's role-based workflows. For access or deletion questions, email anviraservicesllp@gmail.com with the email used to sign in. Support may need to verify account ownership. Do not send a password, OTP or payment details. Ask support what data can be removed and what records remain; this review page does not promise a retention period or automatic erasure.",
  },
  {
    title: "Before production use",
    text: "The business must confirm its legal identity and address, privacy contact, data purposes, providers, access practices, retention rules and applicable rights before approving a production privacy policy. These review statements must be replaced or separately approved for the production service. SAMPLE bookings and professional profiles do not authorize real service delivery or settlements.",
  },
];

export default function ReviewPolicies({
  kind,
}: {
  kind: "terms" | "privacy";
}) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ivory }}>
      <ScrollView
        contentContainerStyle={{
          padding: 24,
          paddingBottom: 48,
          gap: 24,
          maxWidth: 760,
          width: "100%",
          alignSelf: "center",
        }}
      >
        <Link href="/welcome" style={{ color: c.green, fontSize: 16 }}>
          ANVIRA Services
        </Link>
        <T accessibilityRole="header" size={30} bold color={c.forest}>
          {kind === "terms"
            ? "REVIEW-ONLY terms"
            : "REVIEW-ONLY privacy information"}
        </T>
        <Card>
          <T bold>TEST ENVIRONMENT · review-only-v1</T>
          <T>
            For client review with Razorpay test mode. SAMPLE prices and
            professionals are fictional. No real orders, services or
            settlements.
          </T>
        </Card>
        {(kind === "terms" ? terms : privacy).map((section) => (
          <Card key={section.title}>
            <T accessibilityRole="header" size={20} bold>
              {section.title}
            </T>
            <T size={16}>{section.text}</T>
          </Card>
        ))}
        <Link href="tel:+917989365699" style={{ color: c.green, fontSize: 16 }}>
          Call +91 79893 65699
        </Link>
        <Link
          href="mailto:anviraservicesllp@gmail.com"
          style={{ color: c.green, fontSize: 16 }}
        >
          Email review support
        </Link>
        <Link
          href={kind === "terms" ? "/review-privacy" : "/review-terms"}
          style={{ color: c.green, fontSize: 16 }}
        >
          {kind === "terms"
            ? "Review-only privacy information"
            : "Review-only terms"}
        </Link>
        <Link href="/delete-account" style={{ color: c.green, fontSize: 16 }}>
          Account deletion information
        </Link>
      </ScrollView>
    </SafeAreaView>
  );
}
