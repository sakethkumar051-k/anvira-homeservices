import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link } from "expo-router";
import { Card, T, c } from "./ui";

const requestUrl: `mailto:${string}` = `mailto:anviraservicesllp@gmail.com?subject=${encodeURIComponent("ANVIRA account deletion request")}&body=${encodeURIComponent(
  "Hello ANVIRA Customer Care,\n\nPlease delete my ANVIRA account and associated personal data.\n\nAccount email: [email used to sign in]\nName on account: [your name]\n\nPlease explain any records that must be retained and help me verify ownership before processing this request.\n",
)}`;

export default function AccountDeletion() {
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
        <T accessibilityRole="header" size={32} bold color={c.forest}>
          Delete your ANVIRA account
        </T>
        <T size={16}>
          You can request account and associated personal data deletion by
          email, even if you no longer have the app. No website sign-in is
          needed.
        </T>
        <Card>
          <T accessibilityRole="header" size={20} bold>
            Request deletion by email
          </T>
          <T>
            Email anviraservicesllp@gmail.com with the email address used for
            your ANVIRA account and your name. Send from that account email if
            possible. Customer Care will verify ownership before processing your
            request.
          </T>
          <Link
            href={requestUrl}
            style={{
              color: c.green,
              fontSize: 16,
              fontWeight: "600",
              paddingVertical: 12,
            }}
          >
            Email deletion request
          </Link>
          <T color={c.muted}>
            Review and send the draft in your email app. Opening this link does
            not send a message or delete your account. Never send your password,
            OTP or payment details.
          </T>
        </Card>
        <Card>
          <T accessibilityRole="header" size={20} bold>
            Delete from the app
          </T>
          <T>
            Open Profile → Account settings → Delete my account. Type DELETE and
            choose Confirm account deletion. You may need to sign in again.
          </T>
          <T>
            Active bookings, pending refunds and partner balances must be
            settled before in-app deletion can finish. Contact Customer Care if
            you cannot sign in or need help with these steps.
          </T>
        </Card>
        <Card>
          <T accessibilityRole="header" size={20} bold>
            What happens to your data
          </T>
          <T>
            In-app deletion removes profile details, saved addresses, device
            registrations and your profile photo. It replaces your name and
            street address on your customer bookings and removes your sent
            conversation message text and support-request content. Some booking,
            financial and audit records remain. Ask Customer Care which records
            must be retained and for how long before your request is processed.
          </T>
        </Card>
        <Link href="/welcome" style={{ color: c.green, fontSize: 16 }}>
          Back to website
        </Link>
      </ScrollView>
    </SafeAreaView>
  );
}
