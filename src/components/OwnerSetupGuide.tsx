import { View } from "react-native";
import { Link } from "expo-router";
import { useApp } from "../lib/context";
import { ownerSetupProgress } from "../lib/service-management";
import { Card, T, Badge, c, Row } from "./ui";

export default function OwnerSetupGuide() {
  const { state } = useApp();
  if (!state) return null;
  const progress = ownerSetupProgress(state);
  const steps = [
    {
      title: "Define your services",
      detail:
        "Set the work included, exclusions and what one booking covers. Add packages, required choices, add-ons or questions for any service. Publish only prices and scope you have reviewed.",
      href: "/dashboard/services",
      action: "Manage services",
    },
    {
      title: "Set your coverage",
      detail:
        "Choose service PIN codes, office dispatch and customer support details. Check policy and payment settings before launch.",
      href: "/dashboard/settings",
      action: "Review coverage & settings",
    },
    {
      title: "Add your internal team",
      detail:
        "Add each worker’s skills, service areas and schedule. Internal workers have no email, password or app account; the office assigns their work.",
      href: "/dashboard/workers",
      action: "Manage internal workers",
    },
    {
      title: "Give Customer Associates access",
      detail:
        "Choose the staff member’s email and password in Staff access. Share those credentials privately with that person. Passwords are not emailed. Staff can use Reset password on the staff portal.",
      href: "/dashboard/settings?section=staff",
      action: "Create Customer Associate account",
    },
  ];
  const next = progress.findIndex((done) => !done);
  const environment = state.features?.paymentEnvironment;
  return (
    <Card style={{ backgroundColor: c.ivory }}>
      <Badge label="Owner setup guide" />
      <T bold size={23}>
        A clear path to your first order
      </T>
      <T color={c.muted}>
        These markers reflect current service, coverage, worker and staff
        records. They do not certify launch readiness.
      </T>
      <Badge
        label={
          state.mode === "demo" || environment === "simulated"
            ? "Demo · payments are simulated"
            : environment === "test"
              ? "Razorpay test mode · no live payments"
              : environment === "live"
                ? "Live payment configuration · verify launch checks"
                : "Payment environment needs verification"
        }
        tone="amber"
      />
      {steps.map((step, index) => (
        <View key={step.title} style={{ gap: 8, paddingTop: 12 }}>
          <Row style={{ flexWrap: "wrap", justifyContent: "space-between" }}>
            <T bold>{index + 1 + ". " + step.title}</T>
            <Badge
              label={
                progress[index] ? "Record present · review" : "Needs setup"
              }
              tone={progress[index] ? "green" : "amber"}
            />
          </Row>
          <T size={13} color={c.muted}>
            {step.detail}
          </T>
          <Link
            href={step.href as never}
            accessibilityLabel={step.action}
            style={{
              color: c.green,
              fontWeight: "700",
              paddingVertical: 10,
              textDecorationLine: "underline",
            }}
          >
            {step.action + " →"}
          </Link>
        </View>
      ))}
      <T bold>
        {next >= 0
          ? "Next: " + steps[next].title
          : "Next: review launch requirements and rehearse an order"}
      </T>
      <T size={12} color={c.muted}>
        Review the launch checks below, then practise assigning a paid test
        order and recording the visit before accepting live customers.
      </T>
      <Link
        href="/dashboard/bookings"
        style={{
          color: c.green,
          fontWeight: "700",
          paddingVertical: 10,
          textDecorationLine: "underline",
        }}
      >
        Open orders & dispatch →
      </Link>
    </Card>
  );
}
