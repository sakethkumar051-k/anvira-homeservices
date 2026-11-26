import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, router } from "expo-router";
import { Card, T, c } from "./ui";
import {
  BUSINESS,
  privacyPolicy,
  termsOfService,
  type LegalSection,
} from "../lib/legal";

const linkStyle = { color: c.green, fontSize: 16, paddingVertical: 8 };

export default function LegalPolicy({ kind }: { kind: "terms" | "privacy" }) {
  const sections: LegalSection[] =
    kind === "terms" ? termsOfService : privacyPolicy;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ivory }}>
      <ScrollView
        contentContainerStyle={{
          padding: 24,
          paddingBottom: 48,
          gap: 20,
          maxWidth: 760,
          width: "100%",
          alignSelf: "center",
        }}
      >
        <T
          accessibilityRole="link"
          color={c.green}
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/")
          }
          style={{ paddingVertical: 8 }}
        >
          ← Back
        </T>
        <T accessibilityRole="header" size={30} bold color={c.forest}>
          {kind === "terms" ? "Terms of Service" : "Privacy Policy"}
        </T>
        <T color={c.muted}>
          {BUSINESS.name} · Effective {BUSINESS.effectiveDate}
        </T>
        {sections.map((section) => (
          <Card key={section.title}>
            <T accessibilityRole="header" size={20} bold>
              {section.title}
            </T>
            {section.text.map((line) => (
              <T key={line} size={15}>
                {line}
              </T>
            ))}
          </Card>
        ))}
        <Card>
          <T accessibilityRole="header" size={20} bold>
            Contact us
          </T>
          <View style={{ gap: 4 }}>
            <T>{BUSINESS.name}</T>
            {!!BUSINESS.address && <T>{BUSINESS.address}</T>}
            {!!BUSINESS.grievanceOfficer && (
              <T>Grievance officer: {BUSINESS.grievanceOfficer}</T>
            )}
          </View>
          <Link href={`mailto:${BUSINESS.email}`} style={linkStyle}>
            {BUSINESS.email}
          </Link>
          <Link href={BUSINESS.phoneHref} style={linkStyle}>
            {BUSINESS.phone}
          </Link>
        </Card>
        <Link href={kind === "terms" ? "/privacy" : "/terms"} style={linkStyle}>
          {kind === "terms" ? "Privacy Policy" : "Terms of Service"}
        </Link>
        <Link href="/delete-account" style={linkStyle}>
          Delete your account
        </Link>
      </ScrollView>
    </SafeAreaView>
  );
}
