import { useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, router } from "expo-router";
import { LIVE } from "../lib/runtime";
import { useApp } from "../lib/context";
import { Role } from "../lib/model";
import { Button, T, Card, Badge, c, Row, Icon } from "./ui";
const chapters: {
  role: Role;
  title: string;
  time: string;
  detail: string;
  actions: [string, string][];
}[] = [
  {
    role: "customer",
    title: "Choose, customize, book",
    time: "2 MIN",
    detail:
      "Open car cleaning. Compare the exterior and Inside & out packages, select vehicle size and water access, enter the model and parking instructions, then choose a slot. Try DEMO100 at checkout. The payment button simulates payment.",
    actions: [
      ["Try car cleaning", "/checkout/car-cleaning"],
      ["View sample bookings", "/bookings"],
    ],
  },
  {
    role: "professional",
    title: "Deliver with confidence",
    time: "1 MIN",
    detail:
      "Open Ravi’s jobs to see the accepted car clean. Read the customer’s exact choices and parking instructions, reply in the conversation, record arrival, start the service, complete the checklist and leave care instructions.",
    actions: [
      ["Open professional jobs", "/jobs"],
      ["See professional profile", "/partner"],
      ["See partner earnings", "/earnings"],
    ],
  },
  {
    role: "owner",
    title: "Run the business",
    time: "1 MIN",
    detail:
      "Inspect service value and booking queues. Edit a service’s packages, required customer questions, scope, FAQs and checklist. Review the cancelled AC booking’s refund request and the launch readiness panel.",
    actions: [
      ["Open Owner overview", "/dashboard/home"],
      ["Customize services", "/dashboard/services"],
      ["Review sample refund", "/dashboard/refunds"],
    ],
  },
  {
    role: "care",
    title: "Close the loop",
    time: "1 MIN",
    detail:
      "Open the sample sofa-quality request. Read the support history, send a useful reply and resolve it with a clear explanation. Care can coordinate bookings; the Owner approves financial refunds.",
    actions: [["Open Customer Care", "/dashboard/support"]],
  },
];
export default function ProductDemo() {
  const { login, busy, error } = useApp();
  const [entering, setEntering] = useState(false);
  if (LIVE) return <Redirect href="/" />;
  async function enter(role: Role, href: string) {
    if (entering) return;
    setEntering(true);
    try {
      await login(
        role,
        role === "professional" && href === "/earnings" ? "pro-2" : undefined,
      );
      router.push(href as never);
    } finally {
      setEntering(false);
    }
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ivory }}>
      <ScrollView
        contentContainerStyle={{
          maxWidth: 720,
          width: "100%",
          alignSelf: "center",
          padding: 24,
          gap: 20,
          paddingBottom: 60,
        }}
      >
        <Card style={{ backgroundColor: c.green, padding: 28 }}>
          <Row>
            <Icon name="spark" color={c.white} />
            <T color={c.white} bold>
              ANVIRA / PRODUCT WALKTHROUGH
            </T>
          </Row>
          <T size={34} bold color={c.white}>
            Good care, from booking to finish.
          </T>
          <T color={c.white}>A five-minute guided demo for your client.</T>
        </Card>
        <Badge label="Isolated demo · fictional people and prices · no charges" />
        <T color={c.muted}>
          Ten detailed services, two saved addresses, a confirmed car clean, a
          completed sofa service with a sample review, a support conversation
          and an AC refund request. Changes stay in this local demo.
        </T>
        {!!error && <T color={c.red}>{error}</T>}
        {chapters.map((chapter, i) => (
          <Card key={chapter.role}>
            <Row>
              <T bold size={30} color={c.green}>
                {"0" + (i + 1)}
              </T>
              <View style={{ flex: 1 }}>
                <T size={21} bold>
                  {chapter.title}
                </T>
                <T size={11} color={c.muted}>
                  {chapter.role.toUpperCase() + " · " + chapter.time}
                </T>
              </View>
            </Row>
            <T>{chapter.detail}</T>
            {chapter.actions.map(([label, href]) => (
              <Button
                key={href}
                label={label}
                secondary
                disabled={busy || entering}
                onPress={() => void enter(chapter.role, href)}
              />
            ))}
          </Card>
        ))}
        <Card style={{ backgroundColor: c.mint }}>
          <T bold>What this preview proves</T>
          <T>
            Explore the product and simulate a complete service journey. Live
            payments, provider setup, push delivery on devices, approved legal
            policies and a public launch still need real business configuration
            and verification.
          </T>
        </Card>
        <Button
          label="Open customer sample"
          disabled={busy || entering}
          onPress={() => void enter("customer", "/home")}
        />
        <Button
          label="Browse sample catalog"
          secondary
          onPress={() => router.push("/catalog")}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
